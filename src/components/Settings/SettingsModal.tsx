import { useStore, type TeammateMode } from "../../stores/store";
import { CmdopAuthSection } from "./CmdopAuthSection";

export function SettingsModal() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setShowSettings = useStore((s) => s.setShowSettings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-white/10 w-[520px] max-h-[85vh] overflow-y-auto shadow-2xl ring-1 ring-white/5">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-zinc-900/95 backdrop-blur-xl z-10">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <span className="text-xl">⚙️</span> Settings
          </h2>
          <button
            onClick={() => setShowSettings(false)}
            className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-white/10 transition-all text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6 space-y-8">
          {/* Terminal section */}
          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-zinc-700"></span>
              Terminal
              <span className="flex-1 h-px bg-zinc-700/50"></span>
            </h3>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg border border-transparent hover:border-white/5 hover:bg-white/5 transition-all">
                <input
                  type="checkbox"
                  checked={settings.useTmux}
                  onChange={(e) => updateSettings({ useTmux: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-200 group-hover:text-white">
                    Launch in tmux
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Wraps sessions in tmux for persistence and split-panes. Requires <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">tmux</code> installed.
                  </div>
                </div>
              </label>
            </div>
          </section>

          {/* Claude Code section */}
          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-zinc-700"></span>
              Claude Code
              <span className="flex-1 h-px bg-zinc-700/50"></span>
            </h3>

            {/* Teammate mode */}
            <div className="space-y-3 mb-6">
              <div className="text-sm font-medium text-zinc-200">Teammate Mode</div>
              <div className="text-xs text-zinc-500 mb-2">
                Controls how multi-agent sessions are displayed
              </div>
              <div className="grid grid-cols-1 gap-2">
                {([
                  {
                    value: "auto" as TeammateMode,
                    label: "Auto",
                    desc: "Smart split (tmux) or in-process",
                    icon: "🤖"
                  },
                  {
                    value: "in-process" as TeammateMode,
                    label: "In-process",
                    desc: "Single pane, switch with Shift+Arrows",
                    icon: "📝"
                  },
                  {
                    value: "tmux" as TeammateMode,
                    label: "Tmux Splits",
                    desc: "Dedicated panes per agent",
                    icon: "🪟"
                  },
                ]).map((opt) => (
                  <label
                    key={opt.value}
                    className={`
                      flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all
                      ${settings.teammateMode === opt.value
                        ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
                        : "bg-zinc-800/30 border-white/5 hover:bg-zinc-800 hover:border-white/10"
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="teammateMode"
                      checked={settings.teammateMode === opt.value}
                      onChange={() => updateSettings({ teammateMode: opt.value })}
                      className="sr-only"
                    />
                    <div className="text-xl">{opt.icon}</div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${settings.teammateMode === opt.value ? "text-blue-200" : "text-zinc-300"}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-zinc-500">{opt.desc}</div>
                    </div>
                    {settings.teammateMode === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Skip permissions toggle */}
            <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg border border-transparent hover:border-white/5 hover:bg-white/5 transition-all">
              <input
                type="checkbox"
                checked={settings.dangerouslySkipPermissions}
                onChange={(e) =>
                  updateSettings({ dangerouslySkipPermissions: e.target.checked })
                }
                className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500 focus:ring-offset-0"
              />
              <div>
                <div className="text-sm font-medium text-zinc-200 group-hover:text-white flex items-center gap-2">
                  Skip permission prompts
                  <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 uppercase font-bold tracking-wider">Danger</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Automatically approves all tool use. Use with caution.
                </div>
              </div>
            </label>
          </section>

          {/* CMDOP section */}
          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-zinc-700"></span>
              Remote Access (CMDOP)
              <span className="flex-1 h-px bg-zinc-700/50"></span>
            </h3>

            <div className="bg-zinc-950/50 p-4 rounded-lg border border-white/5">
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={settings.cmdopApiKey}
                  onChange={(e) => updateSettings({ cmdopApiKey: e.target.value })}
                  placeholder="cmd_..."
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-mono transition-all"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Required for connecting to remote machines via CMDOP gRPC.
              </p>
            </div>

            <div className="mt-4">
              <CmdopAuthSection />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-zinc-950/50 backdrop-blur-xl flex justify-between items-center sticky bottom-0 rounded-b-xl">
          <div className="text-xs text-zinc-500 italic">
            Changes apply to new sessions
          </div>
          <button
            onClick={() => setShowSettings(false)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
