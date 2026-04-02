# Architecture

Open Agent Manager is a desktop application for managing parallel AI coding agent sessions. It is built with Tauri 2 (Rust backend + React frontend) and ships as a native app for macOS, Linux, and Windows.

## Repository Structure

```
open-agent-manager/
  app/                  # Tauri desktop app (git submodule)
    src/                # React frontend (TypeScript)
    src-tauri/          # Rust backend
      src/
        main.rs         # Entry point -- calls lib::run()
        lib.rs          # Tauri builder, plugin init, command registration
        projects.rs     # Project CRUD, JSON persistence
        prompts.rs      # Prompt queue persistence
        servers.rs      # Server (SSH/CMDOP) CRUD
        ssh.rs          # SSH key listing, remote mkdir, remote ls
        cmdop.rs        # CMDOP bridge process management
        tasks.rs        # Task card persistence
        cmdop_bridge.py # Python bridge for CMDOP gRPC streaming
      Cargo.toml
      tauri.conf.json
    vite.config.ts
    package.json
  website/              # Next.js landing page (git submodule)
  scripts/
    release.sh          # Version bump, tag, push, CI wait, publish
  .github/workflows/
    release.yml         # Multi-platform build on tag push
  version               # Single source of truth for app version
  docs/                 # This documentation
```

Both `app/` and `website/` are git submodules pointing to separate repositories.

## Tauri Backend (Rust)

The backend is a standard Tauri 2 application. The entry point is `main.rs`, which delegates to `lib.rs`. The builder registers four Tauri plugins and all invoke commands:

**Plugins:**
- `tauri-plugin-shell` -- shell command execution
- `tauri-plugin-pty` -- pseudo-terminal management (via `tauri_plugin_pty`)
- `tauri-plugin-http` -- HTTP client (used for CMDOP API calls, bypasses CORS)
- `tauri-plugin-dialog` -- native file/folder picker dialogs

**Backend modules:**

| Module | Responsibility |
|---|---|
| `projects.rs` | CRUD for projects. Persists to `projects.json` in the app data directory. Supports add, remove, archive, restore, duplicate, reorder, and icon loading. |
| `servers.rs` | CRUD for server definitions (SSH or CMDOP). Persists to `servers.json`. |
| `prompts.rs` | Per-project prompt card queue. Persists to `prompts.json` as a `HashMap<project_id, Vec<PromptCard>>`. |
| `tasks.rs` | Per-project task cards. Persists to `tasks.json`. |
| `ssh.rs` | Lists SSH keys from `~/.ssh/`, executes remote `mkdir -p` and `ls` via SSH subprocess. |
| `cmdop.rs` | Manages CMDOP bridge processes. Spawns `cmdop_bridge.py` as a child process, communicates via stdin/stdout JSON lines, and emits terminal events to the frontend. |

**Data persistence:** All data is stored as JSON files in the OS-specific Tauri app data directory (e.g., `~/Library/Application Support/com.suenot.open-agent-manager/` on macOS). Files are created on demand if they do not exist.

## React Frontend (TypeScript)

The frontend is a single-page React 19 application built with Vite 6 and styled with Tailwind CSS 4.

### Component Tree

```
App
  Sidebar              # Project list with drag-and-drop reorder
    SortableProjectItem
    ImportView
  TerminalTabs         # Session tabs with drag-and-drop reorder, CLI picker
    SortableTabItem
  TerminalPane         # xterm.js terminal with PTY (local or SSH)
  RemoteTerminalPane   # CMDOP remote terminal via bridge
  PromptQueue          # Sortable prompt card queue panel
    SortablePromptCard
  AddProjectModal      # Create/edit project (local, SSH, CMDOP modes)
  AddServerModal       # Create/edit server definitions
  ServerListModal      # List and manage saved servers
  SettingsModal        # App settings (tmux, teammate mode, permissions, CMDOP auth)
  ErrorOverlay         # Error toast notifications
```

### State Management

All global state lives in a single Zustand store (`app/src/stores/store.ts`). Key state slices:

- **projects** -- loaded from backend on mount via `invoke("get_projects")`
- **sessions** -- terminal sessions (in-memory, not persisted across restarts)
- **prompts** -- per-project prompt cards, loaded lazily, persisted via backend
- **tasks** -- per-project task cards
- **servers** -- server definitions
- **settings** -- app settings, persisted to `localStorage`
- **errors** -- error overlay queue

Settings are saved to `localStorage` under the key `ccam-settings`. CMDOP auth tokens are stored under `ccam-cmdop-auth`.

### Terminal System

Terminals use [xterm.js](https://xtermjs.org/) with the FitAddon for responsive sizing. Each `TerminalPane` spawns a PTY process via `tauri-pty`:

1. **Local mode** -- spawns `/bin/zsh -l` in the project directory
2. **SSH mode** -- spawns `/usr/bin/ssh` with identity file, port, and a remote command (`cd <path> && exec $SHELL -l`)
3. **CMDOP mode** -- uses `RemoteTerminalPane` which communicates through a Python bridge process

After the shell starts, the configured CLI agent command is automatically written to the PTY (e.g., `claude --dangerously-skip-permissions`). If tmux mode is enabled, the CLI runs inside a tmux session.

A `ptyRegistry` utility maps session IDs to write functions, allowing prompt cards to be sent to any active terminal.

### Drag-and-Drop

The app uses `@dnd-kit` extensively:
- **Sidebar** -- vertical drag-and-drop to reorder projects (persisted to backend)
- **Terminal tabs** -- horizontal drag-and-drop to reorder session tabs
- **Prompt queue** -- vertical drag-and-drop to reorder prompt cards (persisted)
- **Prompt-to-terminal** -- native HTML drag from prompt cards to the terminal drop zone, which writes content to the active PTY

## Data Flow

```
User Action
  -> React Component
    -> Zustand Store (optimistic update)
      -> Tauri invoke("command", { args })
        -> Rust handler
          -> Read/write JSON in app data dir
          -> Return result
    -> Store updated with server response
```

For terminals, the flow is:
```
User types in xterm.js
  -> terminal.onData()
    -> pty.write(data)
      -> PTY process (shell/SSH/bridge)
        -> pty.onData()
          -> terminal.write(output)
```

## Website

The `website/` submodule is a Next.js application serving as a landing/marketing page. It reads the app version from the root `version` file via the `NEXT_PUBLIC_APP_VERSION` environment variable.

## Version Management

A single `version` file at the repository root is the source of truth. The release script propagates it to:
- `app/src-tauri/tauri.conf.json`
- `app/src-tauri/Cargo.toml`
- `app/package.json`
- `website/package.json`

The Vite build injects the version as `__APP_VERSION__` (a compile-time constant) for display in the sidebar footer.
