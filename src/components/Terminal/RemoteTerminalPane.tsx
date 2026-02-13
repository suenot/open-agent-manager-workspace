import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";
import { useStore, type AppSettings } from "../../stores/store";
import type { RemoteConfig } from "../../types";
import { ptyRegistry } from "../../utils/ptyRegistry";

/** Terminal session returned from gRPC via Tauri command */
interface GrpcTerminalSession {
  session_id: string;
  machine_name: string;
  hostname: string;
  status: string;
  os: string;
  agent_version: string;
  shell: string;
  connected_at: string;
}

interface AgentRunResult {
  text: string;
  success: boolean;
}

interface RemoteTerminalPaneProps {
  sessionId: string;
  isVisible: boolean;
  onExit?: () => void;
  settings: AppSettings;
  remote: RemoteConfig;
  cli?: string;
}

const THEME = {
  background: "#1a1b26",
  foreground: "#c0caf5",
  cursor: "#c0caf5",
  selectionBackground: "#33467c",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#a9b1d6",
  brightBlack: "#414868",
  brightRed: "#f7768e",
  brightGreen: "#9ece6a",
  brightYellow: "#e0af68",
  brightBlue: "#7aa2f7",
  brightMagenta: "#bb9af7",
  brightCyan: "#7dcfff",
  brightWhite: "#c0caf5",
};

/**
 * Inner terminal component — xterm.js + agent.run() for command execution.
 * Uses gRPC agent.run() to execute commands and get output (~3-5s per command).
 */
function RemoteTerminalInner({
  sessionId,
  isVisible,
  onExit,
  settings,
  remote,
  cli,
  cmdopSessionId,
}: RemoteTerminalPaneProps & { cmdopSessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const addError = useStore((s) => s.addError);
  const addErrorRef = useRef(addError);
  addErrorRef.current = addError;
  const apiKey = useStore((s) => s.settings.cmdopApiKey);
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  // Line buffer for command input
  const lineBufferRef = useRef("");
  const isRunningRef = useRef(false);
  const cwdRef = useRef(remote.remote_path || "~");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  // Execute a command via agent.run()
  const executeCommand = useCallback(
    async (command: string): Promise<AgentRunResult | null> => {
      if (!terminalRef.current) return null;
      isRunningRef.current = true;

      try {
        const result = await invoke<AgentRunResult>("cmdop_agent_run", {
          apiKey: apiKeyRef.current,
          sessionId: cmdopSessionId,
          command,
        });

        if (terminalRef.current && result.text) {
          const lines = result.text.split("\n");
          for (const line of lines) {
            terminalRef.current.writeln(line);
          }
        }
        if (terminalRef.current && !result.success) {
          terminalRef.current.writeln(
            `\x1b[31m[command failed]\x1b[0m`,
          );
        }
        return result;
      } catch (err) {
        if (terminalRef.current) {
          terminalRef.current.writeln(
            `\x1b[31mError: ${String(err)}\x1b[0m`,
          );
        }
        addErrorRef.current(
          "Remote Terminal",
          `agent.run failed: ${String(err)}`,
          `Machine: ${remote.machine}, Session: ${cmdopSessionId}`,
        );
        return null;
      } finally {
        isRunningRef.current = false;
      }
    },
    [cmdopSessionId, remote.machine],
  );

  // Print prompt
  const printPrompt = useCallback(() => {
    if (!terminalRef.current) return;
    const cwd = cwdRef.current;
    const shortCwd = cwd.replace(/^\/home\/[^/]+/, "~");
    terminalRef.current.write(
      `\x1b[32m${remote.machine}\x1b[0m:\x1b[34m${shortCwd}\x1b[0m$ `,
    );
  }, [remote.machine]);

  // Handle command submission
  const handleCommand = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed) {
        printPrompt();
        return;
      }

      // Add to history
      historyRef.current.push(trimmed);
      historyIndexRef.current = -1;

      // Handle special commands
      if (trimmed === "exit" || trimmed === "logout") {
        if (terminalRef.current) {
          terminalRef.current.writeln(`\x1b[33m[Session ended]\x1b[0m`);
        }
        onExitRef.current?.();
        return;
      }

      if (trimmed === "clear") {
        terminalRef.current?.clear();
        printPrompt();
        return;
      }

      // Handle cd — track cwd
      if (trimmed === "cd" || trimmed.startsWith("cd ")) {
        const dir = trimmed === "cd" ? "~" : trimmed.slice(3).trim();
        const result = await executeCommand(
          `cd ${cwdRef.current} && cd ${dir} && pwd`,
        );
        if (result?.success && result.text.trim()) {
          // Last non-empty line is pwd output
          const lines = result.text.trim().split("\n");
          cwdRef.current = lines[lines.length - 1] || cwdRef.current;
        }
        printPrompt();
        return;
      }

      // Regular command — wrap with cd to maintain cwd context
      await executeCommand(`cd ${cwdRef.current} && ${trimmed}`);
      printPrompt();
    },
    [executeCommand, printPrompt],
  );

  const handleCommandRef = useRef(handleCommand);
  handleCommandRef.current = handleCommand;
  const printPromptRef = useRef(printPrompt);
  printPromptRef.current = printPrompt;

  // Initialize xterm.js
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: THEME,
      scrollback: 10000,
      allowProposedApi: true,
      macOptionIsMeta: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });

    terminal.writeln(
      `\x1b[36mConnected to remote machine: ${remote.machine}\x1b[0m`,
    );
    terminal.writeln(`\x1b[90mSession: ${cmdopSessionId}\x1b[0m`);
    terminal.writeln(
      `\x1b[90mMode: command execution via gRPC (~3-5s per command)\x1b[0m`,
    );
    terminal.writeln("");

    // Handle keyboard input — line-based editing
    const inputDisposable = terminal.onData((data) => {
      if (isRunningRef.current) return;

      for (let i = 0; i < data.length; i++) {
        const char = data[i];

        if (char === "\r" || char === "\n") {
          terminal.writeln("");
          const cmd = lineBufferRef.current;
          lineBufferRef.current = "";
          handleCommandRef.current(cmd);
        } else if (char === "\x7f" || char === "\b") {
          if (lineBufferRef.current.length > 0) {
            lineBufferRef.current = lineBufferRef.current.slice(0, -1);
            terminal.write("\b \b");
          }
        } else if (char === "\x03") {
          lineBufferRef.current = "";
          terminal.writeln("^C");
          printPromptRef.current();
        } else if (char === "\x15") {
          const len = lineBufferRef.current.length;
          lineBufferRef.current = "";
          terminal.write("\b \b".repeat(len));
        } else if (char === "\x1b" && data[i + 1] === "[") {
          // Arrow keys: ESC [ A/B/C/D
          const arrow = data[i + 2];
          i += 2;
          if (arrow === "A") {
            // Up arrow
            if (historyRef.current.length > 0) {
              if (historyIndexRef.current === -1) {
                historyIndexRef.current = historyRef.current.length - 1;
              } else if (historyIndexRef.current > 0) {
                historyIndexRef.current--;
              }
              const len = lineBufferRef.current.length;
              terminal.write("\b \b".repeat(len));
              const entry = historyRef.current[historyIndexRef.current];
              lineBufferRef.current = entry;
              terminal.write(entry);
            }
          } else if (arrow === "B") {
            // Down arrow
            const len = lineBufferRef.current.length;
            terminal.write("\b \b".repeat(len));
            if (
              historyIndexRef.current >= 0 &&
              historyIndexRef.current < historyRef.current.length - 1
            ) {
              historyIndexRef.current++;
              const entry = historyRef.current[historyIndexRef.current];
              lineBufferRef.current = entry;
              terminal.write(entry);
            } else {
              historyIndexRef.current = -1;
              lineBufferRef.current = "";
            }
          }
          // Ignore left/right arrows for now
        } else if (char >= " ") {
          lineBufferRef.current += char;
          terminal.write(char);
        }
      }
    });

    // Register for programmatic input (prompt queue)
    ptyRegistry.register(sessionId, (data) => {
      if (isRunningRef.current) return;
      const lines = data.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          terminal.writeln(line);
          handleCommandRef.current(line);
        }
      }
    });

    // Auto-start: resolve initial cwd, then optionally start CLI
    const cliName = cli || "claude";
    (async () => {
      // Resolve initial cwd
      try {
        const pwdResult = await invoke<AgentRunResult>("cmdop_agent_run", {
          apiKey: apiKeyRef.current,
          sessionId: cmdopSessionId,
          command: `cd ${remote.remote_path} 2>/dev/null && pwd || echo "${remote.remote_path}"`,
        });
        if (pwdResult.success && pwdResult.text.trim()) {
          const lines = pwdResult.text.trim().split("\n");
          cwdRef.current = lines[lines.length - 1] || remote.remote_path;
        }
      } catch {
        // keep default
      }

      if (cliName !== "none") {
        // Start CLI via sendInput (sends to the actual remote PTY)
        let cliCmd: string;
        if (cliName === "claude") {
          const flags: string[] = [];
          if (settings.dangerouslySkipPermissions) {
            flags.push("--dangerously-skip-permissions");
          }
          if (settings.teammateMode !== "auto") {
            flags.push(`--teammate-mode ${settings.teammateMode}`);
          }
          cliCmd = `claude ${flags.join(" ")}`.trim();
        } else {
          cliCmd = cliName;
        }

        terminal.writeln(`\x1b[33mStarting ${cliName} on remote machine...\x1b[0m`);
        terminal.writeln(
          `\x1b[90m(CLI runs on remote PTY — use agent.run commands to interact)\x1b[0m`,
        );
        terminal.writeln("");

        try {
          await invoke("cmdop_send_input", {
            apiKey: apiKeyRef.current,
            sessionId: cmdopSessionId,
            data: `cd ${remote.remote_path} && ${cliCmd}\n`,
          });
        } catch (err) {
          terminal.writeln(`\x1b[31mFailed to start CLI: ${String(err)}\x1b[0m`);
        }
      }

      printPromptRef.current();
    })();

    // Resize handling
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            try {
              fitAddon.fit();
            } catch {
              // ignore
            }
          }, 50);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      ptyRegistry.unregister(sessionId);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, cmdopSessionId, remote.machine]);

  // Re-fit when tab becomes visible
  useEffect(() => {
    if (!isVisible || !fitAddonRef.current) return;
    const timer = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {
        // ignore
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isVisible]);

  // Window resize
  useEffect(() => {
    const onResize = () => {
      if (!isVisible) return;
      try {
        fitAddonRef.current?.fit();
      } catch {
        // ignore
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{ backgroundColor: THEME.background }}
    />
  );
}

/**
 * Layer 2: Connector — loads sessions via gRPC, finds matching machine.
 */
function RemoteTerminalConnector(props: RemoteTerminalPaneProps) {
  const settings = useStore((s) => s.settings);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const [sessions, setSessions] = useState<GrpcTerminalSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiKey = settings.cmdopApiKey;

  useEffect(() => {
    if (!apiKey) {
      setError("CMDOP API key not set. Add it in Settings.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    invoke<GrpcTerminalSession[]>("list_cmdop_sessions", { apiKey })
      .then((result) => {
        if (!cancelled) {
          console.log("[CMDOP] gRPC sessions:", result);
          setSessions(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[CMDOP] gRPC error:", err);
          setError(typeof err === "string" ? err : String(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const targetMachine = props.remote.machine || "";
  const matchedSession = sessions.find(
    (s) =>
      s.machine_name.toLowerCase() === targetMachine.toLowerCase() ||
      s.hostname.toLowerCase().includes(targetMachine.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: THEME.background }}
      >
        <div className="text-center text-gray-400">
          <div className="text-sm">Loading sessions via gRPC...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: THEME.background }}
      >
        <div className="text-center text-red-400">
          <div className="text-lg font-medium mb-2">
            Failed to load sessions
          </div>
          <div className="text-sm text-gray-500 mb-4">{error}</div>
          {!apiKey && (
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Open Settings
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!matchedSession) {
    const machineNames = [...new Set(sessions.map((s) => s.machine_name))];
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: THEME.background }}
      >
        <div className="text-center text-gray-400">
          <div className="text-lg font-medium mb-2">No active session</div>
          <div className="text-sm text-gray-500">
            No active terminal session for machine &quot;{props.remote.machine}
            &quot;.
            <br />
            Make sure the CMDOP agent is running on the remote machine.
          </div>
          {machineNames.length > 0 && (
            <div className="mt-3 text-xs text-gray-600">
              Available machines: {machineNames.join(", ")}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <RemoteTerminalInner
      {...props}
      cmdopSessionId={matchedSession.session_id}
    />
  );
}

/**
 * Layer 1: Auth check — needs API key for gRPC.
 * Uses agent.run() via gRPC — no WebSocket/OAuth required.
 */
export function RemoteTerminalPane(props: RemoteTerminalPaneProps) {
  const settings = useStore((s) => s.settings);
  const setShowSettings = useStore((s) => s.setShowSettings);

  if (!settings.cmdopApiKey) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: THEME.background }}
      >
        <div className="text-center text-gray-400">
          <div className="text-lg font-medium mb-2">
            CMDOP API Key Required
          </div>
          <div className="text-sm text-gray-500 mb-4">
            Set your CMDOP API key (cmd_...) in Settings to connect to remote
            machines.
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  return <RemoteTerminalConnector {...props} />;
}
