import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawn } from "tauri-pty";
import type { IPty } from "tauri-pty";
import "@xterm/xterm/css/xterm.css";

interface TerminalPaneProps {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  isVisible: boolean;
  onExit?: () => void;
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

export function TerminalPane({
  sessionId,
  cwd,
  env,
  isVisible,
  onExit,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<IPty | null>(null);
  const ptyAliveRef = useRef(false);
  const initializedRef = useRef(false);
  // Store callbacks in refs to avoid dependency issues
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // Main initialization — runs ONCE per mount
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

    // Debug: log container dimensions
    const rect = containerRef.current.getBoundingClientRect();
    console.log(`[Terminal ${sessionId}] container: ${rect.width}x${rect.height}, cols=${terminal.cols}, rows=${terminal.rows}, cwd=${cwd}`);

    // Fit after DOM settles
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        console.log(`[Terminal ${sessionId}] after fit: cols=${terminal.cols}, rows=${terminal.rows}`);
      } catch {
        // ignore
      }
    });

    // ResizeObserver for container size changes
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            try {
              fitAddon.fit();
              if (ptyRef.current && ptyAliveRef.current) {
                ptyRef.current.resize(terminal.cols, terminal.rows);
              }
            } catch {
              // ignore
            }
          }, 50);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Build env: ensure TERM is set for proper shell behavior
    const spawnEnv: Record<string, string> = {
      TERM: "xterm-256color",
      ...(env && Object.keys(env).length > 0 ? env : {}),
    };

    // Spawn PTY
    const decoder = new TextDecoder();
    try {
      const pty = spawn("/bin/zsh", ["-l"], {
        cwd,
        env: spawnEnv,
        cols: terminal.cols || 80,
        rows: terminal.rows || 24,
      });
      ptyRef.current = pty;
      ptyAliveRef.current = true;
      console.log(`[Terminal ${sessionId}] PTY spawned with TERM=xterm-256color`);

      pty.onData((data) => {
        terminal.write(decoder.decode(new Uint8Array(data)));
      });

      pty.onExit(({ exitCode }) => {
        console.log(`[Terminal ${sessionId}] PTY exited with code ${exitCode}`);
        ptyAliveRef.current = false;
        pty.write = () => {};
        pty.resize = () => {};
        terminal.writeln(
          `\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`,
        );
        onExitRef.current?.();
      });

      terminal.onData((data) => {
        if (ptyAliveRef.current) {
          pty.write(data);
        }
      });

      // Auto-start claude after shell initializes
      setTimeout(() => {
        if (ptyAliveRef.current) {
          pty.write("claude --dangerously-skip-permissions\n");
        }
      }, 500);
    } catch (err) {
      terminal.writeln(
        `\x1b[31mFailed to start terminal: ${String(err)}\x1b[0m`,
      );
    }

    // Cleanup
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();

      ptyAliveRef.current = false;
      if (ptyRef.current) {
        ptyRef.current.write = () => {};
        ptyRef.current.resize = () => {};
        ptyRef.current.kill();
        ptyRef.current = null;
      }

      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, cwd]);

  // Re-fit when tab becomes visible
  useEffect(() => {
    if (!isVisible || !fitAddonRef.current || !terminalRef.current) return;

    const timer = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
        if (ptyRef.current && ptyAliveRef.current && terminalRef.current) {
          ptyRef.current.resize(terminalRef.current.cols, terminalRef.current.rows);
        }
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
        if (ptyRef.current && ptyAliveRef.current && terminalRef.current) {
          ptyRef.current.resize(terminalRef.current.cols, terminalRef.current.rows);
        }
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
