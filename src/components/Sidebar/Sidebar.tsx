import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores/store";
import type { Project } from "../../types";

export function Sidebar() {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const addSession = useStore((s) => s.addSession);
  const setActiveSessionId = useStore((s) => s.setActiveSessionId);
  const setShowAddProject = useStore((s) => s.setShowAddProject);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const settings = useStore((s) => s.settings);

  // Derive active project from active session
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeProjectId = activeSession?.projectId ?? null;

  const handleProjectClick = (project: Project) => {
    // If this project already has sessions, switch to the first one
    const projectSessions = sessions.filter((s) => s.projectId === project.id);
    if (projectSessions.length > 0) {
      setActiveSessionId(projectSessions[0].id);
      return;
    }

    // No sessions yet — create one with default CLI
    addSession({
      id: `session-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      projectIcon: project.icon,
      status: "running",
      cli: project.cli || "claude",
    });
  };

  const handleRemoveProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      const updated = await invoke<Project[]>("remove_project", {
        projectId,
      });
      setProjects(updated);
    } catch (err) {
      console.error("Failed to remove project:", err);
    }
  };

  const activeCount = sessions.filter((s) => s.status === "running").length;

  return (
    <div className="w-60 bg-gray-900 border-r border-gray-700/50 flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <h1 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Projects
        </h1>
        <button
          onClick={() => setShowAddProject(true)}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded transition-colors text-lg leading-none"
          title="Add project"
        >
          +
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            <div className="mb-3 text-3xl opacity-40">📂</div>
            No projects yet.
            <br />
            <button
              onClick={() => setShowAddProject(true)}
              className="mt-2 text-blue-400 hover:text-blue-300 underline"
            >
              Add your first project
            </button>
          </div>
        )}

        {projects.map((project) => {
          const projectSessions = sessions.filter((s) => s.projectId === project.id);
          const hasSession = projectSessions.length > 0;
          const isActiveProject = activeProjectId === project.id;
          return (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className={`
                group w-full px-3 py-2.5 text-left flex items-center gap-2.5
                transition-colors cursor-pointer
                ${isActiveProject ? "bg-blue-600/15 border-l-2 border-blue-500" : hasSession ? "bg-gray-800/60 border-l-2 border-transparent" : "hover:bg-gray-800/40 border-l-2 border-transparent"}
              `}
            >
              <span className="text-lg flex-shrink-0">{project.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate flex items-center gap-1.5">
                  {project.name}
                  {project.remote && (
                    <span
                      className="text-[10px] text-cyan-400 bg-cyan-400/10 px-1 rounded"
                      title={`Remote: ${project.remote.machine}`}
                    >
                      R
                    </span>
                  )}
                </div>
                {project.description && (
                  <div className="text-xs text-gray-500 truncate">
                    {project.description}
                  </div>
                )}
                {project.remote && (
                  <div className="text-xs text-cyan-500/60 truncate">
                    {project.remote.machine}
                  </div>
                )}
              </div>
              {hasSession && (
                <span className="text-[10px] text-gray-500 flex-shrink-0">
                  {projectSessions.length}
                </span>
              )}
              {!hasSession && (
                <button
                  onClick={(e) => handleRemoveProject(e, project.id)}
                  className="hidden group-hover:flex w-5 h-5 items-center justify-center text-gray-500 hover:text-red-400 rounded text-xs transition-colors flex-shrink-0"
                  title="Remove project"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-700/50 text-xs text-gray-500 flex items-center justify-between">
        <span>{activeCount} active session{activeCount !== 1 ? "s" : ""}</span>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-100 transition-colors text-lg"
          title="Settings"
        >
          {settings.useTmux && <span className="text-green-500 text-xs" title="tmux enabled">T</span>}
          <span>⚙</span>
        </button>
      </div>
    </div>
  );
}
