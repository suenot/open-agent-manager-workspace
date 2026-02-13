import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores/store";
import type { Project } from "../../types";

const ICONS = ["📁", "🚀", "🤖", "📈", "🔧", "🎮", "🌐", "📦", "🎨", "⚡"];

const CLI_PRESETS = [
  { value: "claude", label: "Claude Code" },
  { value: "gemini", label: "Gemini CLI" },
  { value: "aider", label: "Aider" },
  { value: "codex", label: "Codex" },
  { value: "opencode", label: "OpenCode" },
  { value: "kilocode", label: "Kilo Code" },
  { value: "none", label: "Terminal Only" },
  { value: "custom", label: "Custom" },
];

type ProjectMode = "local" | "ssh" | "cmdop";

export function AddProjectModal() {
  const setShowAddProject = useStore((s) => s.setShowAddProject);
  const setProjects = useStore((s) => s.setProjects);

  const [mode, setMode] = useState<ProjectMode>("local");
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [icon, setIcon] = useState("📁");
  const [description, setDescription] = useState("");
  // CMDOP fields
  const [machine, setMachine] = useState("");
  const [remotePath, setRemotePath] = useState("");
  // SSH fields
  const [sshHost, setSshHost] = useState("");
  const [sshUser, setSshUser] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshKey, setSshKey] = useState("");
  const [sshPath, setSshPath] = useState("");
  const [sshKeys, setSshKeys] = useState<string[]>([]);

  const [cliPreset, setCliPreset] = useState("claude");
  const [customCli, setCustomCli] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load SSH keys on mount
  useEffect(() => {
    invoke<string[]>("list_ssh_keys")
      .then(setSshKeys)
      .catch(() => setSshKeys([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (mode === "local" && !path.trim()) {
      setError("Path is required");
      return;
    }

    if (mode === "cmdop") {
      if (!machine.trim()) {
        setError("Machine name is required");
        return;
      }
      if (!remotePath.trim()) {
        setError("Remote path is required");
        return;
      }
    }

    if (mode === "ssh") {
      if (!sshHost.trim()) {
        setError("SSH host is required");
        return;
      }
      if (!sshPath.trim()) {
        setError("Remote path is required");
        return;
      }
    }

    if (cliPreset === "custom" && !customCli.trim()) {
      setError("Custom CLI command is required");
      return;
    }

    const cli = cliPreset === "custom" ? customCli.trim() : cliPreset;

    setSaving(true);
    try {
      let project: Project;
      if (mode === "local") {
        project = {
          id: `proj-${Date.now()}`,
          name: name.trim(),
          path: path.trim(),
          icon,
          description: description.trim() || undefined,
          env_vars: {},
          cli,
        };
      } else if (mode === "ssh") {
        const port = parseInt(sshPort) || 22;
        project = {
          id: `proj-${Date.now()}`,
          name: name.trim(),
          path: `ssh://${sshUser.trim() || "root"}@${sshHost.trim()}:${port}${sshPath.trim()}`,
          icon,
          description: description.trim() || undefined,
          env_vars: {},
          remote: {
            type: "ssh",
            host: sshHost.trim(),
            user: sshUser.trim() || undefined,
            port: port !== 22 ? port : undefined,
            identity_file: sshKey || undefined,
            remote_path: sshPath.trim(),
          },
          cli,
        };
      } else {
        project = {
          id: `proj-${Date.now()}`,
          name: name.trim(),
          path: `cmdop://${machine.trim()}${remotePath.trim()}`,
          icon,
          description: description.trim() || undefined,
          env_vars: {},
          remote: {
            type: "cmdop",
            machine: machine.trim(),
            remote_path: remotePath.trim(),
          },
          cli,
        };
      }

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

        {/* Mode tabs */}
        <div className="flex border-b border-gray-700/50">
          {(["local", "ssh", "cmdop"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === m
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {m === "local" ? "Local" : m === "ssh" ? "SSH" : "CMDOP"}
            </button>
          ))}
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

          {/* Local: Path */}
          {mode === "local" && (
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
          )}

          {/* SSH: Host, User, Port, Key, Path */}
          {mode === "ssh" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Host</label>
                  <input
                    type="text"
                    value={sshHost}
                    onChange={(e) => setSshHost(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">User</label>
                  <input
                    type="text"
                    value={sshUser}
                    onChange={(e) => setSshUser(e.target.value)}
                    placeholder="root"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Port</label>
                  <input
                    type="text"
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
                    placeholder="22"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SSH Key</label>
                  <select
                    value={sshKey}
                    onChange={(e) => setSshKey(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  >
                    <option value="">Default (ssh-agent)</option>
                    {sshKeys.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Remote path</label>
                <input
                  type="text"
                  value={sshPath}
                  onChange={(e) => setSshPath(e.target.value)}
                  placeholder="/home/user/projects/my-project"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                />
              </div>
            </>
          )}

          {/* CMDOP: Machine + Remote Path */}
          {mode === "cmdop" && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Machine name
                </label>
                <input
                  type="text"
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  placeholder="my-server"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                />
                <div className="text-xs text-gray-500 mt-1">
                  CMDOP machine name (from `cmdop connect --name`)
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Remote path
                </label>
                <input
                  type="text"
                  value={remotePath}
                  onChange={(e) => setRemotePath(e.target.value)}
                  placeholder="/home/user/projects/my-project"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                />
              </div>
            </>
          )}

          {/* CLI selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">CLI Tool</label>
            <div className="flex gap-1.5 flex-wrap">
              {CLI_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setCliPreset(preset.value)}
                  className={`
                    px-3 py-1.5 text-sm rounded transition-colors cursor-pointer
                    ${cliPreset === preset.value ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {cliPreset === "custom" && (
              <input
                type="text"
                value={customCli}
                onChange={(e) => setCustomCli(e.target.value)}
                placeholder="my-ai-tool --flag"
                className="w-full mt-2 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
            )}
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
