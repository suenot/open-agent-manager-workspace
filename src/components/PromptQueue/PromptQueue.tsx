import { useEffect, useRef, useState } from "react";
import { useStore } from "../../stores/store";
import type { PromptCard } from "../../types";

interface PromptQueueProps {
  projectId: string;
}

export function PromptQueue({ projectId }: PromptQueueProps) {
  const prompts = useStore((s) => s.prompts[projectId] || []);
  const loadPrompts = useStore((s) => s.loadPrompts);
  const addPrompt = useStore((s) => s.addPrompt);
  const removePrompt = useStore((s) => s.removePrompt);
  const updatePrompt = useStore((s) => s.updatePrompt);
  const reorderPrompts = useStore((s) => s.reorderPrompts);
  const setShowPromptQueue = useStore((s) => s.setShowPromptQueue);

  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  useEffect(() => {
    loadPrompts(projectId);
  }, [projectId, loadPrompts]);

  const handleAdd = () => {
    const card: PromptCard = {
      id: `prompt-${Date.now()}`,
      text: "",
      images: [],
    };
    addPrompt(projectId, card);
  };

  const handleImagePaste = (
    e: React.ClipboardEvent,
    card: PromptCard,
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          updatePrompt(projectId, {
            ...card,
            images: [...card.images, dataUrl],
          });
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const handleRemoveImage = (card: PromptCard, imgIdx: number) => {
    updatePrompt(projectId, {
      ...card,
      images: card.images.filter((_, i) => i !== imgIdx),
    });
  };

  // Internal DnD reorder
  const handleDragStart = (idx: number) => {
    dragSrcIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);

    const srcIdx = dragSrcIdx.current;
    if (srcIdx === null || srcIdx === targetIdx) return;

    const reordered = [...prompts];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    reorderPrompts(projectId, reordered);
    dragSrcIdx.current = null;
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    dragSrcIdx.current = null;
  };

  return (
    <div className="w-80 border-l border-gray-700/50 bg-gray-850 flex flex-col select-none"
      style={{ backgroundColor: "#1e2030" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700/50">
        <h2 className="text-sm font-medium text-gray-300">Prompts</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAdd}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded transition-colors text-lg leading-none"
            title="Add prompt"
          >
            +
          </button>
          <button
            onClick={() => setShowPromptQueue(false)}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-200 rounded transition-colors text-sm"
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {prompts.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-8">
            <div className="text-2xl opacity-40 mb-2">📋</div>
            No prompts yet.
            <br />
            <button
              onClick={handleAdd}
              className="mt-2 text-blue-400 hover:text-blue-300 underline text-xs"
            >
              Add your first prompt
            </button>
          </div>
        )}

        {prompts.map((card, idx) => (
          <div
            key={card.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/ccam-prompt", JSON.stringify({ cardId: card.id, projectId }));
              e.dataTransfer.effectAllowed = "move";
              handleDragStart(idx);
            }}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`
              bg-gray-800 rounded-lg border transition-all cursor-grab active:cursor-grabbing
              ${dragOverIdx === idx ? "border-blue-500 ring-1 ring-blue-500/30" : "border-gray-700/50 hover:border-gray-600"}
            `}
          >
            {/* Card content */}
            <div className="p-2.5">
              <textarea
                value={card.text}
                onChange={(e) =>
                  updatePrompt(projectId, { ...card, text: e.target.value })
                }
                onPaste={(e) => handleImagePaste(e, card)}
                placeholder="Enter prompt text..."
                rows={3}
                className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none"
                onMouseDown={(e) => e.stopPropagation()}
              />

              {/* Image thumbnails */}
              {card.images.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {card.images.map((img, imgIdx) => (
                    <div key={imgIdx} className="relative group">
                      <img
                        src={img}
                        alt=""
                        className="w-14 h-14 object-cover rounded border border-gray-600"
                      />
                      <button
                        onClick={() => handleRemoveImage(card, imgIdx)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card footer */}
            <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-gray-700/30">
              <span className="text-[10px] text-gray-500">
                {card.images.length > 0 && `${card.images.length} img`}
              </span>
              <button
                onClick={() => removePrompt(projectId, card.id)}
                className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                title="Delete prompt"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
