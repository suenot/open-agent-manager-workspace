import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores/store";
import type { Project } from "../../types";

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
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  const [width, setWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, project: Project } | null>(null);

  // Drag and Drop State
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Derive active project from active session
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeProjectId = activeSession?.projectId ?? null;
  const activeCount = sessions.filter((s) => s.status === "running").length;

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

  const handleRemoveProject = async (e: React.MouseEvent | undefined, projectId: string) => {
    if (e) e.stopPropagation();
    try {
      const updated = await invoke<Project[]>("remove_project", {
        projectId,
      });
      setProjects(updated);
    } catch (err) {
      console.error("Failed to remove project:", err);
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

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    // Set data for HTML5 DnD comp
    e.dataTransfer.effectAllowed = "move";
    // Optional: set a drag image or data
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    const src = dragItem.current;
    const dst = dragOverItem.current;
    if (src !== null && dst !== null && src !== dst) {
      const copy = [...projects];
      const [moved] = copy.splice(src, 1);
      copy.splice(dst, 0, moved);
      reorderProjects(copy);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  if (!sidebarVisible) return null;

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

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <h1 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest font-mono">
          Projects
        </h1>
        <button
          onClick={() => { setEditingProject(null); setShowAddProject(true); }}
          className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200"
          title="Add project"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 custom-scrollbar">
        {projects.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-zinc-500 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-xl opacity-50 shadow-inner">
              📂
            </div>
            <p className="mb-2 font-medium">No projects yet</p>
            <button
              onClick={() => { setEditingProject(null); setShowAddProject(true); }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors border-b border-blue-400/30 hover:border-blue-300"
            >
              Add your first project
            </button>
          </div>
        )}

        {projects.map((project, index) => {
          const projectSessions = sessions.filter((s) => s.projectId === project.id);
          const hasSession = projectSessions.length > 0;
          const isActiveProject = activeProjectId === project.id;
          const isContextOpen = contextMenu?.project.id === project.id;

          return (
            <div
              key={project.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => handleProjectClick(project)}
              onContextMenu={(e) => onContextMenu(e, project)}
              className={`
                group w-full px-3 py-2.5 rounded-lg text-left flex items-center gap-3
                transition-all duration-200 cursor-pointer relative overflow-hidden
                ${isActiveProject || isContextOpen
                  ? "bg-blue-500/10 text-blue-100 shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20"
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

              <span className="text-lg flex-shrink-0 transition-transform group-hover:scale-110 duration-200 w-5 h-5 flex items-center justify-center overflow-hidden rounded-sm">
                {project.icon && (project.icon.match(/^(\/|\\|[a-zA-Z]:|http|asset)/)) ? (
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
                      title={`Remote: ${project.remote.machine}`}
                    >
                      REMOTE
                    </span>
                  )}
                </div>
                {/* Only show description or remote info, prioritize minimal look */}
                <div className="flex items-center gap-2 mt-0.5">
                  {project.remote ? (
                    <div className="text-[10px] text-cyan-600 truncate font-mono opacity-80">
                      {project.remote.machine}
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

              {/* Drag Handle (visible on hover) */}
              <div className="opacity-0 group-hover:opacity-10 absolute right-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-1">
                ⋮⋮
              </div>
            </div>
          );
        })}
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
          <button
            onClick={() => { handleRemoveProject(undefined, contextMenu.project.id); setContextMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
          >
            <span>🗑️</span> Delete
          </button>
        </div>
      )}
    </div>
  );
}
