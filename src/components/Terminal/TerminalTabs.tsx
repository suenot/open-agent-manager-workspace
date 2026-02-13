import { useState, useRef, useEffect } from "react";
import { useStore } from "../../stores/store";

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

  // Drag and Drop
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData("text/plain");
    const dragIndex = parseInt(dragIndexStr, 10);

    if (!isNaN(dragIndex) && dragIndex !== dropIndex && activeProjectId) {
      // Create a copy of project sessions and reorder
      const newProjectSessions = [...projectSessions];
      const [moved] = newProjectSessions.splice(dragIndex, 1);
      newProjectSessions.splice(dropIndex, 0, moved);

      // Reconstruct global list
      // We need to carefully preserve sessions from other projects
      // The simplest way is to filter out current project sessions and append the new order
      // This changes global order but keeps per-project order correct which is what matters visually
      const otherSessions = sessions.filter(s => s.projectId !== activeProjectId);
      const newSessions = [...otherSessions, ...newProjectSessions];

      setSessions(newSessions);
    }
  };

  // Even if no active project, we render a placeholder header or nothing
  if (!activeProject) return null;

  return (
    <div className="flex items-center bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-2 select-none h-12 sticky top-0 z-20">
      {/* Project info badge */}
      <div className="mr-3 pl-2 pr-3 py-1 bg-white/5 rounded-md flex items-center gap-2 border border-white/5">
        <span className="text-lg">{activeProject.icon}</span>
        <span className="font-medium text-sm text-zinc-300 truncate max-w-[120px]">
          {activeProject.name}
        </span>
      </div>

      <div className="h-5 w-px bg-white/10 mx-1" />

      {/* Tabs scroll area */}
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto px-1 scrollbar-hide">
        {projectSessions.map((session, idx) => {
          const isActive = activeSessionId === session.id;
          const cliLabel = session.cli || "claude";
          const preset = CLI_PRESETS.find(p => p.value === session.cli) || { icon: "🤖" };

          return (
            <div
              key={session.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={() => setActiveSessionId(session.id)}
              className={`
                group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer
                transition-all duration-200 border-t border-x border-transparent mb-[-1px]
                ${isActive
                  ? "bg-zinc-900 border-white/10 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                }
              `}
            >
              {/* Active Highlight Line */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
              )}
// ... rest remains same

              <span className="text-xs opacity-80">{preset.icon}</span>
              <span className="font-mono text-xs truncate max-w-[100px]">
                {cliLabel}{projectSessions.length > 1 ? ` #${idx + 1}` : ""}
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
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(session.id);
                }}
                className={`
                  ml-1 opacity-0 group-hover:opacity-100 p-0.5 rounded-md
                  hover:bg-red-500/20 hover:text-red-400 transition-all
                  ${isActive ? "opacity-100 text-zinc-500" : "text-zinc-600"}
                `}
                title="Close session"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          );
        })}
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
