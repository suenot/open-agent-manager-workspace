import { useStore } from "../../stores/store";

export function TerminalTabs() {
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const setActiveSessionId = useStore((s) => s.setActiveSessionId);
  const removeSession = useStore((s) => s.removeSession);

  if (sessions.length === 0) return null;

  return (
    <div className="flex items-center bg-gray-900 border-b border-gray-700/50 px-1 select-none">
      {sessions.map((session) => {
        const isActive = activeSessionId === session.id;
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
            <span className="text-xs">{session.projectIcon}</span>
            <span className="truncate max-w-[120px]">
              {session.projectName}
            </span>
            {session.status === "running" && (
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeSession(session.id);
              }}
              className="ml-1 text-gray-500 hover:text-gray-200 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
