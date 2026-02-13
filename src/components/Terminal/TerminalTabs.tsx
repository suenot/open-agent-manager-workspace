import { useState, useRef, useEffect } from "react";
import { useStore } from "../../stores/store";

const CLI_PRESETS = [
  { value: "claude", label: "Claude Code" },
  { value: "gemini", label: "Gemini CLI" },
  { value: "aider", label: "Aider" },
  { value: "codex", label: "Codex" },
  { value: "opencode", label: "OpenCode" },
  { value: "kilocode", label: "Kilo Code" },
  { value: "none", label: "Terminal Only" },
];

export function TerminalTabs() {
  const sessions = useStore((s) => s.sessions);
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

  if (projectSessions.length === 0) return null;

  return (
    <div className="flex items-center bg-gray-900 border-b border-gray-700/50 px-1 select-none">
      {/* Project name label */}
      <span className="px-2 py-2 text-xs text-gray-500 flex items-center gap-1.5">
        <span>{activeProject?.icon}</span>
        <span className="truncate max-w-[100px]">{activeProject?.name}</span>
      </span>

      <span className="w-px h-4 bg-gray-700/50 mx-0.5" />

      {/* Session tabs for current project */}
      {projectSessions.map((session, idx) => {
        const isActive = activeSessionId === session.id;
        const cliLabel = session.cli || "claude";
        return (
          <div
            key={session.id}
            onClick={() => setActiveSessionId(session.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 cursor-pointer
              text-sm transition-colors border-b-2
              ${
                isActive
                  ? "text-gray-100 border-blue-500 bg-gray-800/50"
                  : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/30"
              }
            `}
          >
            <span className="truncate max-w-[100px]">
              {cliLabel}{projectSessions.length > 1 ? ` #${idx + 1}` : ""}
            </span>
            {session.status === "running" && (
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            )}
            {session.status === "stopped" && (
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeSession(session.id);
              }}
              className="ml-0.5 text-gray-500 hover:text-gray-200 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* Add session button — click = claude, right-click/long-press = CLI picker */}
      <button
        onClick={handleAddClick}
        onContextMenu={handleAddContextMenu}
        onPointerDown={handleAddPointerDown}
        onPointerUp={handleAddPointerUp}
        onPointerLeave={handleAddPointerUp}
        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-gray-800/50 rounded transition-colors text-lg leading-none ml-1"
        title="Add session (right-click for CLI picker)"
      >
        +
      </button>

      {/* CLI picker menu */}
      {cliMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-gray-800 border border-gray-600/50 rounded-lg shadow-2xl py-1 min-w-[180px]"
          style={{ left: cliMenu.x, top: cliMenu.y }}
        >
          <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-700/50">
            New session with...
          </div>
          {CLI_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleAddSession(preset.value)}
              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span className="text-gray-400 text-xs w-16 truncate">{preset.value}</span>
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Prompt queue toggle */}
      <button
        onClick={() => setShowPromptQueue(!showPromptQueue)}
        className={`
          px-2.5 py-2 text-sm transition-colors
          ${showPromptQueue ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}
        `}
        title={showPromptQueue ? "Hide prompts" : "Show prompts"}
      >
        &#9776;
      </button>
    </div>
  );
}
