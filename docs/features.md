# Features

## Project Management

### Add Projects
Create projects in three modes:
- **Local** -- point to a directory on your machine using an absolute path or native folder picker
- **SSH** -- connect to a remote server via SSH with host, user, port, and identity file configuration
- **CMDOP** -- connect to a remote machine via the CMDOP platform using an API key and machine name

Each project has a name, path, optional description, icon, and a default CLI agent.

### Project Icons
Projects display custom icons loaded from the project directory. By default, the app looks for `.manager/icon.png` in the project root. You can specify a custom relative path. Supported formats: PNG, JPEG, WebP, SVG, ICO.

### Edit, Duplicate, Archive, Delete
Right-click any project in the sidebar for a context menu with:
- **Edit** -- modify project settings
- **Duplicate** -- create a copy of the project configuration
- **Archive** -- move to the archived section (hidden from active list)
- **Restore** -- bring back from archive
- **Delete** -- permanently remove the project

### Drag-and-Drop Reorder
Drag projects in the sidebar to reorder them. The order is persisted to the backend.

## Server Management

### Saved Servers
Define reusable server configurations (SSH or CMDOP) with connection details and a default projects path. When creating a new project, select a saved server to auto-fill connection fields.

### SSH Key Detection
The app automatically discovers SSH private keys in `~/.ssh/` and presents them in a dropdown when configuring SSH projects.

### Auto Directory Creation
When adding an SSH project, the app automatically runs `mkdir -p` on the remote server to ensure the project directory exists.

## Terminal Sessions

### Multiple Parallel Sessions
Launch multiple terminal sessions per project. Each session runs in its own PTY with a full xterm.js terminal emulator featuring:
- 256-color support
- Scrollback buffer (10,000 lines)
- Cursor blink
- macOS Option-as-Meta key support
- WebGL rendering (when available)

### Session Tabs
Terminal tabs appear at the top of the main area. Tabs show the CLI agent name, a status indicator (running/idle/stopped), and can be closed individually. Tabs support drag-and-drop reorder.

### Idle Detection
Sessions automatically transition from "running" to "idle" status after 2 seconds of no PTY output. The status indicator in tabs and the sidebar reflects the current state with color-coded dots:
- Green (pulsing) -- running
- Blue -- idle
- Gray -- stopped

### Auto-Start CLI Agent
When a session starts, the configured CLI agent command is automatically written to the terminal. For Claude Code, additional flags are appended based on settings (e.g., `--dangerously-skip-permissions`, `--teammate-mode`).

## Supported CLI Agents

The following agents are available as presets:

| Preset | Command | Description |
|---|---|---|
| Claude Code | `claude` | Anthropic's Claude Code CLI |
| Gemini CLI | `gemini` | Google's Gemini CLI |
| Aider | `aider` | AI pair programming tool |
| Codex | `codex` | OpenAI Codex CLI |
| OpenCode | `opencode` | Open-source coding agent |
| Kilo Code | `kilocode` | Kilo Code agent |
| Factory Droid | `droid` | Factory Droid agent |
| Terminal Only | `none` | Opens a plain shell without launching any agent |
| Custom | (user-defined) | Any custom command string |

New sessions default to the project's configured CLI. Alt+click or right-click the "+" button to choose a different agent for that session.

## Prompt Queue

### Prompt Cards
The prompt queue is a side panel where you prepare prompts before sending them to an agent. Each card supports:
- **Text** -- multi-line prompt text with auto-expanding textarea
- **Image paste** -- paste images from clipboard directly into a card
- **File attachments** -- attach files via the "Attach" button, file picker, or drag-and-drop onto a card
- **Reorder** -- drag cards within the queue to change order

### Drag-to-Terminal
Drag a prompt card from the queue onto the active terminal to send it. The card's attachments are written first (as base64 data URLs), followed by the text content. The card is removed from the queue after sending.

### Per-Project Queues
Each project has its own independent prompt queue, persisted to the backend.

## Settings

### Terminal Settings
- **Launch in tmux** -- wraps agent sessions in tmux for persistence and split-pane support

### Claude Code Settings
- **Teammate Mode** -- controls multi-agent display: Auto, In-process, or Tmux Splits
- **Skip permission prompts** -- passes `--dangerously-skip-permissions` to Claude Code

### Remote Access (CMDOP)
- **API Key** -- configure the CMDOP API key for remote machine access
- **OAuth Authentication** -- device code flow authentication for CMDOP

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + B` | Toggle sidebar visibility |

## Error Handling

An error overlay displays runtime errors, unhandled promise rejections, and backend failures as dismissible toast notifications. Each error shows the source, message, and optional details.

## Sidebar

The sidebar displays two sections:
- **Active Projects** -- sortable list of active projects with status indicators
- **Archived** -- dimmed list of archived projects

The sidebar is resizable by dragging the right edge (200px to 600px range). The app version is shown at the bottom.
