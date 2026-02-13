import { useStore, type TeammateMode } from "../../stores/store";
import { CmdopAuthSection } from "./CmdopAuthSection";

export function SettingsModal() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setShowSettings = useStore((s) => s.setShowSettings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 rounded-lg border border-gray-600 w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-gray-100">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="text-gray-400 hover:text-gray-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Terminal section */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">
              Terminal
            </h3>

            {/* tmux toggle */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.useTmux}
                onChange={(e) => updateSettings({ useTmux: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <div>
                <div className="text-sm text-gray-200 group-hover:text-white">
                  Launch claude inside tmux
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Enables split-pane mode for Claude teams. Requires tmux installed.
                </div>
              </div>
            </label>
          </section>

          {/* Claude Code section */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">
              Claude Code
            </h3>

            {/* Teammate mode */}
            <div className="space-y-2">
              <div className="text-sm text-gray-200">Teams display mode</div>
              <div className="text-xs text-gray-500 mb-2">
                Controls how Claude Code teams render panes
              </div>
              <div className="space-y-1.5">
                {([
                  {
                    value: "auto" as TeammateMode,
                    label: "Auto",
                    desc: "Split panes if inside tmux, otherwise in-process",
                  },
                  {
                    value: "in-process" as TeammateMode,
                    label: "In-process",
                    desc: "All teammates run in the main terminal (Shift+Up/Down to switch)",
                  },
                  {
                    value: "tmux" as TeammateMode,
                    label: "tmux",
                    desc: "Each teammate gets its own split pane (requires tmux)",
                  },
                ]).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 cursor-pointer group px-3 py-2 rounded hover:bg-gray-700/50"
                  >
                    <input
                      type="radio"
                      name="teammateMode"
                      checked={settings.teammateMode === opt.value}
                      onChange={() => updateSettings({ teammateMode: opt.value })}
                      className="mt-0.5 w-4 h-4 border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <div>
                      <div className="text-sm text-gray-200 group-hover:text-white">
                        {opt.label}
                      </div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Skip permissions toggle */}
            <label className="flex items-start gap-3 cursor-pointer group mt-4">
              <input
                type="checkbox"
                checked={settings.dangerouslySkipPermissions}
                onChange={(e) =>
                  updateSettings({ dangerouslySkipPermissions: e.target.checked })
                }
                className="mt-0.5 w-4 h-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <div>
                <div className="text-sm text-gray-200 group-hover:text-white">
                  Skip permission prompts
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Pass --dangerously-skip-permissions to claude
                </div>
              </div>
            </label>
          </section>

          {/* CMDOP section */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">
              CMDOP (Remote Access)
            </h3>

            {/* API Key */}
            <div className="mb-4">
              <label className="block text-sm text-gray-200 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={settings.cmdopApiKey}
                onChange={(e) => updateSettings({ cmdopApiKey: e.target.value })}
                placeholder="cmd_..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
              <div className="text-xs text-gray-500 mt-1">
                API key from CMDOP dashboard. Used for gRPC operations (list machines, run commands).
              </div>
            </div>

            {/* OAuth */}
            <CmdopAuthSection />
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-700 flex justify-end">
          <div className="text-xs text-gray-500">
            Changes apply to new sessions
          </div>
        </div>
      </div>
    </div>
  );
}
