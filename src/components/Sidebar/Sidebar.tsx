import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores/store";
import type { Project, SidebarTab } from "../../types";
import { ImportView } from "./ImportView";

export function Sidebar() {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const reorderProjects = useStore((s) => s.reorderProjects);
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const addSession = useStore((s) => s.addSession);
  const setActiveSessionId = useStore((s) => s.setActiveSessionId);
  const setShowAddProject = useStore((s) => s.setShowAddProject);
  const setEditingProject = useStore((s) => s.setEditingProject);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const settings = useStore((s) => s.settings);
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const sidebarTab = useStore((s) => s.sidebarTab);
  const setSidebarTab = useStore((s) => s.setSidebarTab);
  const setShowAddServer = useStore((s) => s.setShowAddServer);
  const setEditingServer = useStore((s) => s.setEditingServer);
  const addError = useStore((s) => s.addError);

  const [width, setWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);

  // Derive active project from active session
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeProjectId = activeSession?.projectId ?? null;
  const activeCount = sessions.filter((s) => s.status === "running").length;

  // Filter projects by tab
  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);

  // Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "default";
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Close Context Menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleProjectClick = (project: Project) => {
    if (project.archived) return; // Don't create sessions from archive

    const projectSessions = sessions.filter((s) => s.projectId === project.id);
    if (projectSessions.length > 0) {
      setActiveSessionId(projectSessions[0].id);
      return;
    }

    addSession({
      id: `session-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      projectIcon: project.icon,
      status: "running",
      cli: project.cli || "claude",
    });
  };

  const handleRemoveProject = async (projectId: string) => {
    try {
      const updated = await invoke<Project[]>("remove_project", { projectId });
      setProjects(updated);
    } catch (err) {
      console.error("Failed to remove project:", err);
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    try {
      const updated = await invoke<Project[]>("archive_project", { projectId });
      setProjects(updated);
    } catch (err) {
      addError("Projects", "Failed to archive project", String(err));
    }
  };

  const handleRestoreProject = async (projectId: string) => {
    try {
      const updated = await invoke<Project[]>("restore_project", { projectId });
      setProjects(updated);
    } catch (err) {
      addError("Projects", "Failed to restore project", String(err));
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowAddProject(true);
    setContextMenu(null);
  };

  const onContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, project });
  };

  // Drag Handlers (only for active tab)
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

    if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
      const copy = [...activeProjects];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(dropIndex, 0, moved);
      // Rebuild full list: reordered active + archived
      reorderProjects([...copy, ...archivedProjects]);
    }
  };

  const getRemoteLabel = (project: Project): string | null => {
    if (!project.remote) return null;
    if (project.remote.type === "ssh") {
      const user = project.remote.user || "root";
      return `${user}@${project.remote.host}`;
    }
    return project.remote.machine || null;
  };

  const handleAddClick = () => {
    if (sidebarTab === "import") {
      setEditingServer(null);
      setShowAddServer(true);
    } else {
      setEditingProject(null);
      setShowAddProject(true);
    }
  };

  if (!sidebarVisible) return null;

  const renderProjectList = (projectList: Project[], isArchive: boolean) => {
    if (projectList.length === 0) {
      return (
        <div className="px-4 py-12 text-center text-sm text-zinc-500 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-xl opacity-50 shadow-inner">
            {isArchive ? "📦" : "📂"}
          </div>
          <p className="mb-2 font-medium">{isArchive ? "No archived projects" : "No projects yet"}</p>
          {!isArchive && (
            <button
              onClick={() => { setEditingProject(null); setShowAddProject(true); }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors border-b border-blue-400/30 hover:border-blue-300"
            >
              Add your first project
            </button>
          )}
        </div>
      );
    }

    return projectList.map((project, index) => {
      const projectSessions = sessions.filter((s) => s.projectId === project.id);
      const hasSession = projectSessions.length > 0;
      const isActiveProject = activeProjectId === project.id;
      const isContextOpen = contextMenu?.project.id === project.id;
      const remoteLabel = getRemoteLabel(project);

      return (
        <div
          key={project.id}
          draggable={!isArchive}
          onDragStart={!isArchive ? (e) => handleDragStart(e, index) : undefined}
          onDragOver={!isArchive ? handleDragOver : undefined}
          onDrop={!isArchive ? (e) => handleDrop(e, index) : undefined}
          onClick={() => handleProjectClick(project)}
          onContextMenu={(e) => onContextMenu(e, project)}
          className={`
            group w-full px-3 py-2.5 rounded-lg text-left flex items-center gap-3
            transition-all duration-200 relative overflow-hidden
            ${isArchive ? "cursor-default" : "cursor-pointer"}
            ${isActiveProject || isContextOpen
              ? "bg-blue-500/10 text-blue-100 shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20"
              : isArchive
                ? "text-zinc-500 hover:bg-white/5"
                : hasSession
                  ? "text-zinc-300 hover:bg-white/5 hover:text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }
          `}
        >
          {/* Active indicator bar */}
          {isActiveProject && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          )}

          <span className={`text-lg flex-shrink-0 transition-transform group-hover:scale-110 duration-200 w-5 h-5 flex items-center justify-center overflow-hidden rounded-sm ${isArchive ? "opacity-50" : ""}`}>
            {project.icon && project.icon.match(/^(\/|\\|[a-zA-Z]:|http|asset)/) ? (
              <img src={project.icon} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="select-none">{project.icon || "📁"}</span>
            )}
          </span>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate flex items-center gap-2">
              {project.name}
              {project.remote && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase bg-cyan-950 text-cyan-400 border border-cyan-500/20"
                  title={`Remote: ${remoteLabel}`}
                >
                  {project.remote.type === "ssh" ? "SSH" : "REMOTE"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {project.remote ? (
                <div className="text-[10px] text-cyan-600 truncate font-mono opacity-80">
                  {remoteLabel}
                </div>
              ) : project.description ? (
                <div className={`text-[11px] truncate ${isActiveProject ? "text-blue-200/60" : "text-zinc-600 group-hover:text-zinc-500"}`}>
                  {project.description}
                </div>
              ) : null}
            </div>
          </div>

          {/* Session count badge */}
          {hasSession && (
            <span className={`
              flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium transition-all
              ${isActiveProject
                ? "bg-blue-500 text-white shadow-sm"
                : "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200"
              }
            `}>
              {projectSessions.length}
            </span>
          )}

          {/* Drag Handle (visible on hover, only for active) */}
          {!isArchive && (
            <div className="opacity-0 group-hover:opacity-10 absolute right-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-1">
              ⋮⋮
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className="bg-zinc-950 border-r border-white/5 flex flex-col select-none font-sans h-screen relative group/sidebar"
      style={{ width }}
    >
      {/* Resizer Handle */}
      <div
        className="absolute top-0 right-0 bottom-0 w-1 bg-transparent hover:bg-blue-500/50 cursor-col-resize z-50 transition-colors"
        onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
      />

      {/* Header with tabs */}
      <div className="border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-1">
            {(["active", "archive", "import"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest rounded-md transition-all relative ${
                  sidebarTab === tab
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                }`}
              >
                {tab === "active" ? "Active" : tab === "archive" ? "Archive" : "Import"}
              </button>
            ))}
          </div>
          <button
            onClick={handleAddClick}
            className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200"
            title={sidebarTab === "import" ? "Add server" : "Add project"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 custom-scrollbar">
        {sidebarTab === "active" && renderProjectList(activeProjects, false)}
        {sidebarTab === "archive" && renderProjectList(archivedProjects, true)}
        {sidebarTab === "import" && <ImportView />}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5 bg-zinc-950/80 backdrop-blur-sm text-xs text-zinc-500 flex items-center justify-between font-mono shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${activeCount > 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" : "bg-zinc-700"}`} />
          <span>{activeCount} active</span>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 relative"
          title="Settings"
        >
          {settings.useTmux && <span className="text-emerald-500 text-[10px] absolute -top-0.5 -right-0.5 font-bold">T</span>}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-40 bg-zinc-900 border border-white/10 rounded-lg shadow-xl py-1 animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-zinc-500 border-b border-white/5 mb-1 truncate">
            {contextMenu.project.name}
          </div>
          <button
            onClick={() => handleEditProject(contextMenu.project)}
            className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white flex items-center gap-2"
          >
            <span>✏️</span> Edit
          </button>
          {contextMenu.project.archived ? (
            <button
              onClick={() => { handleRestoreProject(contextMenu.project.id); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 flex items-center gap-2"
            >
              <span>📤</span> Restore
            </button>
          ) : (
            <button
              onClick={() => { handleArchiveProject(contextMenu.project.id); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 flex items-center gap-2"
            >
              <span>📦</span> Archive
            </button>
          )}
          <button
            onClick={() => { handleRemoveProject(contextMenu.project.id); setContextMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
          >
            <span>🗑️</span> Delete
          </button>
        </div>
      )}
    </div>
  );
}
