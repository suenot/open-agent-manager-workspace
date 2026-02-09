import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores/store";
import type { Project } from "../../types";

const ICONS = ["📁", "🚀", "🤖", "📈", "🔧", "🎮", "🌐", "📦", "🎨", "⚡"];

export function AddProjectModal() {
  const setShowAddProject = useStore((s) => s.setShowAddProject);
  const setProjects = useStore((s) => s.setProjects);

  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [icon, setIcon] = useState("📁");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!path.trim()) {
      setError("Path is required");
      return;
    }

    setSaving(true);
    try {
      const project: Project = {
        id: `proj-${Date.now()}`,
        name: name.trim(),
        path: path.trim(),
        icon,
        description: description.trim() || undefined,
        env_vars: {},
      };

      const updated = await invoke<Project[]>("add_project", { project });
      setProjects(updated);
      setShowAddProject(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setShowAddProject(false)}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-[480px] border border-gray-600/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-lg font-semibold text-gray-100">Add Project</h2>
          <button
            onClick={() => setShowAddProject(false)}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Icon picker */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Icon</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`
                    w-9 h-9 text-lg rounded flex items-center justify-center
                    transition-colors cursor-pointer
                    ${icon === ic ? "bg-blue-600 ring-2 ring-blue-400" : "bg-gray-700 hover:bg-gray-600"}
                  `}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              autoFocus
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Path */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Path (absolute)
            </label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/you/projects/my-project"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddProject(false)}
              className="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
