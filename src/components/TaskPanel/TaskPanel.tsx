import { useEffect, useRef, useState, useMemo } from "react";
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore, getTasksForProject } from "../../stores/store";
import type { TaskCard, TaskStatus } from "../../types";

interface SortableTaskCardProps {
    card: TaskCard;
    editingId: string | null;
    editTitle: string;
    editDescription: string;
    onEditTitleChange: (v: string) => void;
    onEditDescriptionChange: (v: string) => void;
    onSave: () => void;
    onCancel: () => void;
    onRemove: () => void;
    onStartEdit: () => void;
}

function TaskCardItem({
    card,
    editingId,
    editTitle,
    editDescription,
    onEditTitleChange,
    onEditDescriptionChange,
    onSave,
    onCancel,
    onRemove,
    onStartEdit,
    isOverlay = false,
    dragHandleProps = {},
    style = {},
    innerRef,
}: SortableTaskCardProps & { isOverlay?: boolean; dragHandleProps?: any; style?: any; innerRef?: any }) {
    const isEditing = editingId === card.id;

    if (isEditing) {
        return (
            <div ref={innerRef} style={style} className="bg-zinc-800 border border-blue-500/50 rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in duration-200 z-10">
                <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => onEditTitleChange(e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-white mb-2 p-0"
                    placeholder="Task title..."
                />
                <textarea
                    value={editDescription}
                    onChange={(e) => onEditDescriptionChange(e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-xs text-zinc-400 p-0 resize-none min-h-[60px]"
                    placeholder="Description (optional)..."
                />
                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-white/5">
                    <button onClick={onCancel} className="px-2 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-300">CANCEL</button>
                    <button onClick={onSave} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-md transition-colors">SAVE</button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={innerRef}
            style={style}
            {...dragHandleProps}
            onClick={onStartEdit}
            className={`
                group relative bg-zinc-900 border border-white/5 p-3 rounded-xl cursor-pointer
                transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-800/50 hover:shadow-lg
                ${isOverlay ? "bg-zinc-800 border-white/20 z-50 scale-105 shadow-2xi rotate-2" : ""}
            `}
        >
            <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-zinc-200 leading-tight group-hover:text-white transition-colors">{card.title}</h4>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                    ✕
                </button>
            </div>
            {card.description && (
                <p className="text-[11px] text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">{card.description}</p>
            )}
            <div className="flex items-center justify-between mt-3">
                <div className="text-[10px] text-zinc-600 font-medium">#{card.id.slice(-4)}</div>
                <div className="text-[10px] text-zinc-700">{new Date(card.created_at).toLocaleDateString()}</div>
            </div>
        </div>
    );
}

function SortableTaskCard(props: SortableTaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.card.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <TaskCardItem
            {...props}
            innerRef={setNodeRef}
            style={style}
            dragHandleProps={{ ...attributes, ...listeners }}
        />
    );
}

interface TaskPanelProps {
    projectId: string;
}

const STATUS_CONFIG: {
    key: TaskStatus;
    label: string;
    color: string;
    bgColor: string;
    dotColor: string;
}[] = [
        {
            key: "todo",
            label: "To Do",
            color: "text-blue-400",
            bgColor: "bg-blue-500/10",
            dotColor: "bg-blue-400",
        },
        {
            key: "in_progress",
            label: "In Progress",
            color: "text-amber-400",
            bgColor: "bg-amber-500/10",
            dotColor: "bg-amber-400",
        },
        {
            key: "done",
            label: "Done",
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/10",
            dotColor: "bg-emerald-400",
        },
    ];

export function TaskPanel({ projectId }: TaskPanelProps) {
    const tasks = useStore((s) => getTasksForProject(s, projectId));
    const loadTasks = useStore((s) => s.loadTasks);
    const addTask = useStore((s) => s.addTask);
    const removeTask = useStore((s) => s.removeTask);
    const updateTask = useStore((s) => s.updateTask);
    const reorderTasks = useStore((s) => s.reorderTasks);

    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [addingInSection, setAddingInSection] = useState<TaskStatus | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [dragOverSection, setDragOverSection] = useState<TaskStatus | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const dragItemRef = useRef<string | null>(null);
    const dragSourceSection = useRef<TaskStatus | null>(null);

    useEffect(() => {
        loadTasks(projectId);
    }, [projectId, loadTasks]);

    useEffect(() => {
        if (addingInSection && inputRef.current) {
            inputRef.current.focus();
        }
    }, [addingInSection]);

    const handleAdd = (status: TaskStatus) => {
        if (!newTaskTitle.trim()) return;
        const card: TaskCard = {
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: newTaskTitle.trim(),
            description: "",
            status,
            created_at: Date.now(),
        };
        addTask(projectId, card);
        setNewTaskTitle("");
        setAddingInSection(null);
    };

    const handleStatusChange = (card: TaskCard, newStatus: TaskStatus) => {
        updateTask(projectId, { ...card, status: newStatus });
    };

    const handleSaveEdit = (card: TaskCard) => {
        if (editTitle.trim()) {
            updateTask(projectId, {
                ...card,
                title: editTitle.trim(),
                description: editDescription.trim(),
            });
        }
        setEditingId(null);
    };

    const startEdit = (card: TaskCard) => {
        setEditingId(card.id);
        setEditTitle(card.title);
        setEditDescription(card.description || "");
    };

    // ---- Drag & Drop ----
    const handleDragStart = (cardId: string, status: TaskStatus) => {
        dragItemRef.current = cardId;
        dragSourceSection.current = status;
    };

    const handleDragOver = (e: React.DragEvent, cardId?: string, section?: TaskStatus) => {
        e.preventDefault();

        if (section) setDragOverSection(section);

        if (cardId) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const position = e.clientY < midY ? "top" : "bottom";

            if (dragOverId !== cardId || dragOverSection !== (section || null)) {
                setDragOverId(cardId);
                setDragOverSection(section || null);
            }
        } else {
            setDragOverId(null);
        }
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus, targetCardId?: string) => {
        e.preventDefault();
        const draggedId = dragItemRef.current;
        if (!draggedId) return;

        const draggedCard = tasks.find((t) => t.id === draggedId);
        if (!draggedCard) return;

        // Calculate position relative to target card if present
        let position: 'top' | 'bottom' = 'bottom';
        if (targetCardId) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            position = e.clientY < midY ? 'top' : 'bottom';
        }

        // 1. Remove from current list
        let others = tasks.filter((t) => t.id !== draggedId);

        // 2. Prepare updated card
        const updatedCard = { ...draggedCard, status: targetStatus };

        // 3. Insert into target position
        if (targetCardId) {
            const targetIdx = others.findIndex((t) => t.id === targetCardId);
            if (targetIdx >= 0) {
                const insertIdx = position === 'top' ? targetIdx : targetIdx + 1;
                others.splice(insertIdx, 0, updatedCard);
            } else {
                others.push(updatedCard);
            }
        } else {
            // Dropped on section header or empty space — add to end of section
            const sectionCards = others.filter((t) => t.status === targetStatus);
            if (sectionCards.length > 0) {
                const lastIdx = others.lastIndexOf(sectionCards[sectionCards.length - 1]);
                others.splice(lastIdx + 1, 0, updatedCard);
            } else {
                others.push(updatedCard);
            }
        }

        reorderTasks(projectId, others);

        setDragOverId(null);
        setDragOverSection(null);
        dragItemRef.current = null;
        dragSourceSection.current = null;
    };

    const handleDragEnd = () => {
        setDragOverId(null);
        setDragOverSection(null);
        dragItemRef.current = null;
        dragSourceSection.current = null;
    };

    const getTasksForStatus = (status: TaskStatus) =>
        tasks.filter((t) => t.status === status);

    const totalCount = tasks.length;

    return (
        <div className="h-full flex flex-col select-none overflow-hidden">
            {/* Task Sections */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
                {STATUS_CONFIG.map((section) => {
                    const sectionTasks = getTasksForStatus(section.key);
                    const isDropTarget = dragOverSection === section.key;

                    return (
                        <div
                            key={section.key}
                            className={`rounded-lg transition-colors ${isDropTarget ? "ring-1 ring-white/10" : ""
                                }`}
                            onDragOver={(e) => handleDragOver(e, undefined, section.key)}
                            onDrop={(e) => handleDrop(e, section.key)}
                        >
                            {/* Section Header */}
                            <div
                                className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${section.bgColor}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${section.dotColor}`} />
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${section.color}`}>
                                        {section.label}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        {sectionTasks.length}
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        setAddingInSection(section.key);
                                        setNewTaskTitle("");
                                    }}
                                    className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer"
                                    title={`Add task to ${section.label}`}
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>

                            {/* Add Task Input (inline) */}
                            {addingInSection === section.key && (
                                <div className="px-2 py-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAdd(section.key);
                                            if (e.key === "Escape") setAddingInSection(null);
                                        }}
                                        onBlur={() => {
                                            if (newTaskTitle.trim()) handleAdd(section.key);
                                            else setAddingInSection(null);
                                        }}
                                        placeholder="Task title..."
                                        className="w-full px-3 py-2 text-sm bg-zinc-800/80 border border-white/10 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                                    />
                                </div>
                            )}

                            {/* Cards */}
                            <div className="space-y-1 px-1 py-1">
                                {sectionTasks.length === 0 && addingInSection !== section.key && (
                                    <div className="px-3 py-3 text-center text-[11px] text-zinc-600 italic">
                                        No tasks
                                    </div>
                                )}

                                {sectionTasks.map((card) => {
                                    const isDragOver = dragOverId === card.id;
                                    const isEditing = editingId === card.id;

                                    // Calculate precise indicator
                                    // For TaskPanel, we use a simpler approach as we don't store dropPosition in state yet, 
                                    // but we can add it or just highlight the card. I'll add dropPosition to keep it consistent.

                                    return (
                                        <div
                                            key={card.id}
                                            draggable={!isEditing}
                                            onDragStart={() => handleDragStart(card.id, card.status)}
                                            onDragOver={(e) => handleDragOver(e, card.id, section.key)}
                                            onDrop={(e) => {
                                                e.stopPropagation();
                                                handleDrop(e, section.key, card.id);
                                            }}
                                            onDragEnd={handleDragEnd}
                                            className={`group relative px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${isDragOver
                                                ? "border-blue-500 ring-1 ring-blue-500/20 bg-blue-500/5 shadow-lg shadow-blue-500/5 z-10"
                                                : "border-white/5 bg-zinc-800/40 hover:bg-zinc-800/70 hover:border-white/10"
                                                } ${dragItemRef.current === card.id ? "opacity-40" : ""}`}
                                        >
                                            {/* Precise indicator (vertical line simulation via top/bottom border if dragging over) */}
                                            {isDragOver && (
                                                <div className="absolute inset-0 pointer-events-none rounded-lg ring-2 ring-blue-500/50" />
                                            )}
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") handleSaveEdit(card);
                                                            if (e.key === "Escape") setEditingId(null);
                                                        }}
                                                        className="w-full px-2 py-1 text-sm bg-zinc-900 border border-white/10 rounded text-zinc-200 focus:outline-none focus:border-blue-500/50"
                                                        autoFocus
                                                    />
                                                    <textarea
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && e.metaKey) handleSaveEdit(card);
                                                            if (e.key === "Escape") setEditingId(null);
                                                        }}
                                                        placeholder="Description (optional)..."
                                                        rows={2}
                                                        className="w-full px-2 py-1 text-xs bg-zinc-900 border border-white/10 rounded text-zinc-400 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none"
                                                    />
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            onClick={() => handleSaveEdit(card)}
                                                            className="px-2 py-1 text-[10px] rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="px-2 py-1 text-[10px] rounded bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span
                                                            className="text-sm text-zinc-300 leading-snug flex-1 cursor-pointer"
                                                            onDoubleClick={() => startEdit(card)}
                                                        >
                                                            {card.title}
                                                        </span>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                            {/* Status cycle */}
                                                            {section.key !== "done" && (
                                                                <button
                                                                    onClick={() => {
                                                                        const nextStatus: TaskStatus =
                                                                            section.key === "todo" ? "in_progress" : "done";
                                                                        handleStatusChange(card, nextStatus);
                                                                    }}
                                                                    className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                                                    title="Move forward"
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                                        <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {section.key === "done" && (
                                                                <button
                                                                    onClick={() => handleStatusChange(card, "todo")}
                                                                    className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                                                    title="Reopen"
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                                        <path d="M8 5H2M5 8L2 5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {/* Edit */}
                                                            <button
                                                                onClick={() => startEdit(card)}
                                                                className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer"
                                                                title="Edit"
                                                            >
                                                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                                    <path d="M7.5 1.5l1 1-5 5H2v-1.5l5.5-4.5z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            </button>
                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => removeTask(projectId, card.id)}
                                                                className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                                title="Delete"
                                                            >
                                                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                                    <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Description preview */}
                                                    {card.description && (
                                                        <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                                                            {card.description}
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Empty state */}
                {tasks.length === 0 && !addingInSection && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="text-3xl mb-3 opacity-20">📋</div>
                        <p className="text-xs text-zinc-500">
                            No tasks yet. Click <span className="text-zinc-400">+</span> in any section to add one.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
