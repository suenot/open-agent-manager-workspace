# Configuration

## Project Configuration

Each project has the following properties:

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name in the sidebar |
| `path` | string | Local absolute path, or `ssh://` / `cmdop://` URI for remote projects |
| `icon` | string | Emoji fallback icon (default: folder emoji) |
| `icon_path` | string (optional) | Relative path to an icon image file within the project directory. Default: `.manager/icon.png` |
| `description` | string (optional) | Brief project description |
| `env_vars` | object | Environment variables passed to the terminal session |
| `cli` | string (optional) | CLI agent to launch. One of the preset values or a custom command |
| `remote` | object (optional) | Remote connection config (see below) |
| `server_id` | string (optional) | Reference to a saved server definition |
| `archived` | boolean | Whether the project is archived |

### Remote Configuration

For SSH projects:

```json
{
  "type": "ssh",
  "host": "192.168.1.100",
  "user": "root",
  "port": 22,
  "identity_file": "/Users/you/.ssh/id_ed25519",
  "remote_path": "/home/user/projects/my-project"
}
```

For CMDOP projects:

```json
{
  "type": "cmdop",
  "machine": "my-server",
  "remote_path": "/home/user/projects/my-project"
}
```

## Server Definitions

Servers are reusable connection profiles. When creating a project, selecting a server auto-fills the connection fields and computes the remote path from the server's `default_projects_path` combined with the project name.

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name |
| `type` | `"ssh"` or `"cmdop"` | Connection type |
| `host` | string (SSH) | Hostname or IP |
| `user` | string (SSH) | SSH username |
| `port` | number (SSH) | SSH port (default: 22) |
| `identity_file` | string (SSH) | Path to SSH private key |
| `machine` | string (CMDOP) | CMDOP machine name |
| `default_projects_path` | string | Base directory for projects on this server |

## CLI Presets

The app ships with these built-in CLI presets:

| Value | Label | What it runs |
|---|---|---|
| `claude` | Claude Code | `claude [flags]` -- flags depend on settings |
| `gemini` | Gemini CLI | `gemini` |
| `aider` | Aider | `aider` |
| `codex` | Codex | `codex` |
| `opencode` | OpenCode | `opencode` |
| `kilocode` | Kilo Code | `kilocode` |
| `droid` | Factory Droid | `droid` |
| `none` | Terminal Only | No CLI launched, just a shell |
| `custom` | Custom | User-defined command string |

### Claude Code Flags

When the CLI is `claude`, the app conditionally adds flags based on settings:

- `--dangerously-skip-permissions` -- added when "Skip permission prompts" is enabled
- `--teammate-mode <mode>` -- added when teammate mode is not "auto" (possible values: `in-process`, `tmux`)

## App Settings

Settings are stored in the browser's `localStorage` under the key `ccam-settings`.

| Setting | Type | Default | Description |
|---|---|---|---|
| `useTmux` | boolean | `false` | Wrap sessions in tmux |
| `teammateMode` | `"auto"` / `"in-process"` / `"tmux"` | `"auto"` | Multi-agent display mode |
| `dangerouslySkipPermissions` | boolean | `true` | Auto-approve all tool use in Claude Code |
| `cmdopApiKey` | string | `""` | CMDOP platform API key |

## Data Storage Locations

### Backend Data (JSON files)

All persistent data is stored in the Tauri app data directory:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/com.suenot.open-agent-manager/` |
| Linux | `~/.local/share/com.suenot.open-agent-manager/` |
| Windows | `%APPDATA%/com.suenot.open-agent-manager/` |

Files:
- `projects.json` -- project definitions
- `servers.json` -- server definitions
- `prompts.json` -- prompt card queues (keyed by project ID)
- `tasks.json` -- task cards (keyed by project ID)

### Frontend Data (localStorage)

- `ccam-settings` -- app settings (JSON)
- `ccam-cmdop-auth` -- CMDOP OAuth tokens (JSON)

## Tauri App Configuration

The Tauri config is at `app/src-tauri/tauri.conf.json`:

- **Product name:** Open Agent Manager
- **Identifier:** `com.suenot.open-agent-manager`
- **Window:** 1400x900 default, 1000x600 minimum, resizable
- **Dev server:** `http://localhost:1420`
- **Bundle targets:** all (DMG, DEB, AppImage, MSI, NSIS)

## Vite Configuration

Key settings in `app/vite.config.ts`:

- React plugin + Tailwind CSS plugin
- `__APP_VERSION__` defined from root `version` file
- Dev server on port 1420 (strict)
- HMR configured for Tauri dev host
- Ignores `src-tauri/` from file watching

## Project Icon Convention

To give your project a custom icon in the sidebar:

1. Create a `.manager/` directory in your project root
2. Place an image file at `.manager/icon.png`
3. Alternatively, set a custom `icon_path` in the project settings (relative to project root)

Supported formats: PNG, JPEG, WebP, SVG, ICO.
