import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores/store";
import type { Project } from "../../types";

export function Sidebar() {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const sessions = useStore((s) => s.sessions);
  const addSession = useStore((s) => s.addSession);
  const setActiveSessionId = useStore((s) => s.setActiveSessionId);
  const setShowAddProject = useStore((s) => s.setShowAddProject);

  const handleProjectClick = (project: Project) => {
    const existing = sessions.find((s) => s.projectId === project.id);
    if (existing) {
      setActiveSessionId(existing.id);
      return;
    }

    addSession({
      id: `session-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      projectIcon: project.icon,
      status: "running",
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
          const hasSession = sessions.some((s) => s.projectId === project.id);
          return (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className={`
                group w-full px-3 py-2.5 text-left flex items-center gap-2.5
                transition-colors cursor-pointer
                ${hasSession ? "bg-gray-800/60" : "hover:bg-gray-800/40"}
              `}
            >
              <span className="text-lg flex-shrink-0">{project.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">
                  {project.name}
                </div>
                {project.description && (
                  <div className="text-xs text-gray-500 truncate">
                    {project.description}
                  </div>
                )}
              </div>
              {hasSession && (
                <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
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
      <div className="px-4 py-2.5 border-t border-gray-700/50 text-xs text-gray-500">
        {activeCount} active session{activeCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
