import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useStore } from "../../stores/store";

interface SortableTabItemProps {
  session: any;
  isActive: boolean;
  idx: number;
  projectSessionsCount: number;
  cliLabel: string;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onTogglePrompt: (e: React.MouseEvent) => void;
  showPromptQueue: boolean;
}

function TabItem({
  session,
  isActive,
  idx,
  projectSessionsCount,
  cliLabel,
  onSelect,
  onClose,
  onTogglePrompt,
  showPromptQueue,
  isOverlay = false,
  dragHandleProps = {},
  style = {},
  innerRef,
}: SortableTabItemProps & { isOverlay?: boolean; dragHandleProps?: any; style?: any; innerRef?: any }) {
  return (
    <div
      ref={innerRef}
      style={style}
      {...dragHandleProps}
      onClick={onSelect}
      className={`
        group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer
        transition-all duration-200 border-t border-x border-transparent mb-[-1px]
        ${isActive
          ? "bg-zinc-900 border-white/10 text-white shadow-sm"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
        }
        ${isOverlay ? "bg-zinc-800 border-white/20 z-50 scale-105 shadow-xl" : ""}
      `}
    >
      {/* Active Highlight Line */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
      )}

      <span className="font-mono text-xs truncate max-w-[100px]">
        {cliLabel}{projectSessionsCount > 1 ? ` #${idx + 1}` : ""}
      </span>

      {/* Status Indicator */}
      <div className={`
        w-1.5 h-1.5 rounded-full transition-all duration-300
        ${session.status === "running"
          ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
          : "bg-zinc-600"
        }
      `} />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-white/10 transition-all text-zinc-500 hover:text-white"
      >
        ✕
      </button>

      {/* Prompt Queue Toggle (only for active) */}
      {isActive && (
        <button
          onClick={onTogglePrompt}
          className={`
            ml-1 p-0.5 rounded-md transition-all
            ${showPromptQueue
              ? "text-blue-400 bg-blue-500/10"
              : "text-zinc-500 hover:text-white hover:bg-white/10"
            }
          `}
          title="Toggle Prompt Queue"
        >
          📋
        </button>
      )}
    </div>
  );
}

function SortableTabItem(props: SortableTabItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.session.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <TabItem
      {...props}
      innerRef={setNodeRef}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}
const CLI_PRESETS = [
  { value: "claude", label: "Claude Code", icon: "🤖" },
  { value: "gemini", label: "Gemini CLI", icon: "✨" },
  { value: "aider", label: "Aider", icon: "👨‍💻" },
  { value: "codex", label: "Codex", icon: "📝" },
  { value: "opencode", label: "OpenCode", icon: "🔓" },
  { value: "kilocode", label: "Kilo Code", icon: "⚡" },
  { value: "none", label: "Terminal Only", icon: "📟" },
];

export function TerminalTabs() {
  const sessions = useStore((s) => s.sessions);
  const setSessions = useStore((s) => s.setSessions);
  const projects = useStore((s) => s.projects);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const setActiveSessionId = useStore((s) => s.setActiveSessionId);
  const removeSession = useStore((s) => s.removeSession);
  const addSession = useStore((s) => s.addSession);
  const showPromptQueue = useStore((s) => s.showPromptQueue);
  const setShowPromptQueue = useStore((s) => s.setShowPromptQueue);

  const [cliMenu, setCliMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Derive active project from active session
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeProjectId = activeSession?.projectId ?? null;
  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null;

  // Filter sessions for current project only
  const projectSessions = activeProjectId
    ? sessions.filter((s) => s.projectId === activeProjectId)
    : [];

  // Close CLI menu on outside click
  useEffect(() => {
    if (!cliMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCliMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [cliMenu]);

  const handleAddSession = (cli: string) => {
    if (!activeProject) return;
    addSession({
      id: `session-${Date.now()}`,
      projectId: activeProject.id,
      projectName: activeProject.name,
      projectIcon: activeProject.icon,
      status: "running",
      cli,
    });
    setCliMenu(null);
  };

  const handleAddClick = () => {
    // Default: add claude session
    handleAddSession(activeProject?.cli || "claude");
  };

  const handleAddContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCliMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAddPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    longPressTimer.current = setTimeout(() => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setCliMenu({ x: rect.left, y: rect.bottom + 4 });
    }, 500);
  };

  const handleAddPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = projectSessions.findIndex(s => s.id === active.id);
      const newIndex = projectSessions.findIndex(s => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newProjectSessions = arrayMove(projectSessions, oldIndex, newIndex);
        const otherSessions = sessions.filter(s => s.projectId !== activeProjectId);
        setSessions([...otherSessions, ...newProjectSessions]);
      }
    }

    setActiveId(null);
  };

  // Even if no active project, we render a placeholder header or nothing
  if (!activeProject) return null;

  return (
    <div className="flex items-center bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-2 select-none h-12 sticky top-0 z-20">
      {/* Project name badge */}
      <div className="mr-3 px-3 py-1 bg-white/5 rounded-md border border-white/5">
        <span className="font-medium text-sm text-zinc-300 truncate max-w-[120px]">
          {activeProject.name}
        </span>
      </div>

      <div className="h-5 w-px bg-white/10 mx-1" />

      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto px-1 scrollbar-hide">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToHorizontalAxis, restrictToWindowEdges]}
        >
          <SortableContext items={projectSessions.map(s => s.id)} strategy={horizontalListSortingStrategy}>
            {projectSessions.map((session, idx) => (
              <SortableTabItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                idx={idx}
                projectSessionsCount={projectSessions.length}
                cliLabel={session.cli || "claude"}
                onSelect={() => setActiveSessionId(session.id)}
                onClose={(e) => {
                  e.stopPropagation();
                  removeSession(session.id);
                }}
                onTogglePrompt={(e) => {
                  e.stopPropagation();
                  setShowPromptQueue(!showPromptQueue);
                }}
                showPromptQueue={showPromptQueue}
              />
            ))}
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeId ? (
              <TabItem
                session={projectSessions.find(s => s.id === activeId)}
                isActive={activeSessionId === activeId}
                idx={projectSessions.findIndex(s => s.id === activeId)}
                projectSessionsCount={projectSessions.length}
                cliLabel={projectSessions.find(s => s.id === activeId)?.cli || "claude"}
                onSelect={() => { }}
                onClose={() => { }}
                onTogglePrompt={() => { }}
                showPromptQueue={showPromptQueue}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Add session button */}
      <button
        onClick={handleAddClick}
        onContextMenu={handleAddContextMenu}
        onPointerDown={handleAddPointerDown}
        onPointerUp={handleAddPointerUp}
        onPointerLeave={handleAddPointerUp}
        className="ml-2 w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200"
        title="New session (right-click for options)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <div className="w-px h-5 bg-white/10 mx-2" />

      {/* Prompt queue toggle */}
      <button
        onClick={() => setShowPromptQueue(!showPromptQueue)}
        className={`
          p-2 rounded-md transition-all duration-200
          ${showPromptQueue
            ? "text-blue-400 bg-blue-500/10 ring-1 ring-blue-500/20"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
          }
        `}
        title={showPromptQueue ? "Hide prompts" : "Show prompt queue"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
      </button>

      {/* CLI menu popup */}
      {cliMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setCliMenu(null)} />
          <div
            ref={menuRef}
            className="fixed z-50 bg-zinc-900 border border-white/10 rounded-lg shadow-xl py-1 min-w-[200px] backdrop-blur-md animate-fade-in"
            style={{ left: cliMenu.x, top: cliMenu.y }}
          >
            <div className="px-3 py-2 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider border-b border-white/5 bg-zinc-950/30">
              Launch New Session
            </div>
            {CLI_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleAddSession(preset.value)}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-blue-500/10 hover:border-l-2 hover:border-blue-500 transition-all flex items-center gap-3 group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">{preset.icon}</span>
                <div className="flex flex-col">
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-[10px] text-zinc-600 font-mono">{preset.value}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
