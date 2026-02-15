import { useEffect, useRef, useState } from "react";
import { useStore, getPromptsForProject } from "../../stores/store";
import type { PromptCard } from "../../types";

interface PromptQueueProps {
  projectId: string;
}

export function PromptQueue({ projectId }: PromptQueueProps) {
  const prompts = useStore((s) => getPromptsForProject(s, projectId));
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
    <div className="w-80 h-full border-l border-white/5 bg-zinc-900/50 backdrop-blur-md flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-950/30">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <span>📋</span> Queue
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAdd}
            className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-all active:scale-95"
            title="Add new prompt card"
          >
            <span className="text-lg leading-none">+</span>
          </button>
          <button
            onClick={() => setShowPromptQueue(false)}
            className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
              <span className="text-2xl text-zinc-600">📝</span>
            </div>
            <p className="text-sm text-zinc-400 font-medium mb-1">Queue Empty</p>
            <p className="text-xs text-zinc-600 mb-4">
              Add prompts to queue them up for later use.
            </p>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 text-xs font-medium rounded-md border border-blue-500/20 transition-all"
            >
              Create Prompt
            </button>
          </div>
        ) : (
          prompts.map((card, idx) => (
            <div
              key={card.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/ccam-prompt",
                  JSON.stringify({ cardId: card.id, projectId }),
                );
                e.dataTransfer.effectAllowed = "move";
                handleDragStart(idx);
              }}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`
                group relative bg-zinc-800/40 backdrop-blur-sm rounded-lg border transition-all cursor-grab active:cursor-grabbing hover:bg-zinc-800/60 animate-fade-in
                ${dragOverIdx === idx
                  ? "border-blue-500 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/10 z-10 scale-105"
                  : "border-white/5 hover:border-white/10 shadow-sm"
                }
              `}
            >
              {/* Drag Handle */}
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-transparent group-hover:bg-zinc-700/50 transition-colors" />

              {/* Card content */}
              <div className="p-3">
                <textarea
                  value={card.text}
                  onChange={(e) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    updatePrompt(projectId, { ...card, text: e.target.value } as any)
                  }
                  onPaste={(e) => handleImagePaste(e, card)}
                  placeholder="Type prompt here..."
                  rows={3}
                  className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none font-sans"
                  onMouseDown={(e) => e.stopPropagation()}
                />

                {/* Image thumbnails */}
                {card.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-white/5">
                    {card.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="relative group/img">
                        <img
                          src={img}
                          alt=""
                          className="w-12 h-12 object-cover rounded-md border border-white/10"
                        />
                        <button
                          onClick={() => handleRemoveImage(card, imgIdx)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all shadow-sm hover:scale-110"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card footer */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-white/5 bg-zinc-900/30 rounded-b-lg">
                <div className="flex items-center gap-2">
                  {card.images.length > 0 && (
                    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span>🖼️</span> {card.images.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removePrompt(projectId, card.id)}
                  className="text-zinc-600 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100 p-1"
                  title="Delete prompt"
                >
                  <span className="sr-only">Delete</span>
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
