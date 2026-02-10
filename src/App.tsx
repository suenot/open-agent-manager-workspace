import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { AddProjectModal } from "./components/Sidebar/AddProjectModal";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { TerminalTabs } from "./components/Terminal/TerminalTabs";
import { TerminalPane } from "./components/Terminal/TerminalPane";
import { useStore } from "./stores/store";
import type { Project } from "./types";

function App() {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const updateSessionStatus = useStore((s) => s.updateSessionStatus);
  const showAddProject = useStore((s) => s.showAddProject);
  const showSettings = useStore((s) => s.showSettings);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    invoke<Project[]>("get_projects")
      .then(setProjects)
      .catch((err) => console.error("Failed to load projects:", err));
  }, [setProjects]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {showAddProject && <AddProjectModal />}
      {showSettings && <SettingsModal />}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TerminalTabs />

        <div className="flex-1 relative">
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

            return (
              <div
                key={session.id}
                className="absolute inset-0"
                style={{
                  display: activeSessionId === session.id ? "block" : "none",
                }}
              >
                <TerminalPane
                  sessionId={session.id}
                  cwd={project.path}
                  env={project.env_vars}
                  isVisible={activeSessionId === session.id}
                  onExit={() => updateSessionStatus(session.id, "stopped")}
                  settings={settings}
                />
              </div>
            );
          })}
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
    </div>
  );
}

export default App;
