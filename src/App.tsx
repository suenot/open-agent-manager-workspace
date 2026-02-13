import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { AddProjectModal } from "./components/Sidebar/AddProjectModal";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { TerminalTabs } from "./components/Terminal/TerminalTabs";
import { TerminalPane } from "./components/Terminal/TerminalPane";
import { RemoteTerminalPane } from "./components/Terminal/RemoteTerminalPane";
import { PromptQueue } from "./components/PromptQueue/PromptQueue";
import { ErrorOverlay } from "./components/ErrorOverlay/ErrorOverlay";
import { useStore } from "./stores/store";
import { ptyRegistry } from "./utils/ptyRegistry";
import type { Project } from "./types";

function App() {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const updateSessionStatus = useStore((s) => s.updateSessionStatus);
  const showAddProject = useStore((s) => s.showAddProject);
  const showSettings = useStore((s) => s.showSettings);
  const showPromptQueue = useStore((s) => s.showPromptQueue);
  const removePrompt = useStore((s) => s.removePrompt);
  const prompts = useStore((s) => s.prompts);
  const settings = useStore((s) => s.settings);
  const addError = useStore((s) => s.addError);

  useEffect(() => {
    invoke<Project[]>("get_projects")
      .then(setProjects)
      .catch((err) => {
        console.error("Failed to load projects:", err);
        addError("Projects", "Failed to load projects", String(err));
      });
  }, [setProjects, addError]);

  // Global error handlers
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      addError("Window", e.message, `${e.filename}:${e.lineno}:${e.colno}`);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      addError("Promise", String(e.reason));
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [addError]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const handlePromptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/ccam-prompt");
    if (!raw || !activeSessionId) return;
    try {
      const { cardId, projectId } = JSON.parse(raw);
      const cards = prompts[projectId] || [];
      const card = cards.find((c) => c.id === cardId);
      if (card && card.text.trim()) {
        ptyRegistry.write(activeSessionId, card.text.trim() + "\n");
      }
      removePrompt(projectId, cardId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {showAddProject && <AddProjectModal />}
      {showSettings && <SettingsModal />}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TerminalTabs />

        <div className="flex-1 flex min-h-0">
          {/* Terminal area — drop zone for prompt cards */}
          <div
            className="flex-1 relative"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/ccam-prompt")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={handlePromptDrop}
          >
            {/* Empty state */}
            {!activeSession && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <div className="text-5xl mb-4 opacity-50">🤖</div>
                  <div className="text-lg font-medium text-gray-400">
                    Select a project to start
                  </div>
                  <div className="text-sm mt-1">
                    Click a project in the sidebar to open a Claude Code session
                  </div>
                </div>
              </div>
            )}

            {/* Terminal panes — all mounted, visibility toggled */}
            {sessions.map((session) => {
              const project = projects.find((p) => p.id === session.projectId);
              if (!project) return null;

              const isRemote = !!project.remote;
              const isSsh = isRemote && project.remote?.type === "ssh";
              const isCmdop = isRemote && !isSsh;
              const isActive = activeSessionId === session.id;

              return (
                <div
                  key={session.id}
                  className="absolute inset-0"
                  style={{
                    display: isActive ? "block" : "none",
                  }}
                >
                  {isSsh ? (
                    <TerminalPane
                      sessionId={session.id}
                      cwd="/"
                      env={{}}
                      isVisible={isActive}
                      onExit={() => updateSessionStatus(session.id, "stopped")}
                      settings={settings}
                      cli={session.cli || project.cli}
                      sshConfig={project.remote}
                    />
                  ) : isCmdop ? (
                    <RemoteTerminalPane
                      sessionId={session.id}
                      isVisible={isActive}
                      onExit={() => updateSessionStatus(session.id, "stopped")}
                      settings={settings}
                      remote={project.remote!}
                      cli={session.cli || project.cli}
                    />
                  ) : (
                    <TerminalPane
                      sessionId={session.id}
                      cwd={project.path}
                      env={project.env_vars}
                      isVisible={isActive}
                      onExit={() => updateSessionStatus(session.id, "stopped")}
                      settings={settings}
                      cli={session.cli || project.cli}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Prompt Queue panel (toggleable) */}
          {showPromptQueue && activeSession && (
            <PromptQueue projectId={activeSession.projectId} />
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-900 border-t border-gray-700/50 text-xs text-gray-500">
          <span>
            {sessions.filter((s) => s.status === "running").length} agent
            {sessions.filter((s) => s.status === "running").length !== 1
              ? "s"
              : ""}{" "}
            running
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span>ccam v0.1.0</span>
            <button
              onClick={async () => {
                const win = getCurrentWindow();
                await win.maximize();
                await invoke("toggle_devtools");
              }}
              className="hover:text-gray-200 transition-colors cursor-pointer"
              title="Toggle DevTools (F12)"
            >
              {"{/}"}
            </button>
          </span>
        </div>
      </div>
      <ErrorOverlay />
    </div>
  );
}

export default App;
