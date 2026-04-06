# Open Agent Manager

## Tech Stack
- Rust (Tauri backend, see app/src-tauri/src/*.rs, Cargo.toml)
- TypeScript / React (app frontend, see app/src/*.tsx, package.json)
- Vite (frontend build tool, app/vite.config.ts)
- Tailwind CSS (app and website styling, tailwind.config.js, @tailwindcss/vite plugin)
- Tauri (desktop app framework, app/src-tauri/tauri.conf.json)
- Next.js (website frontend, website/package.json, website/next.config.js)
- Zustand (state management in React, app/package.json)
- dnd-kit (drag and drop in React, app/package.json)
- CMDOP API integration (app/src/utils/cmdopApi.ts, cmdopAuth.ts)
- Sharp (image processing, root package.json)

## Commands
- `npm run dev` (in app/ runs Vite dev server)
- `npm run build` (in app/ runs TypeScript compiler and Vite build)
- `npm run tauri` (in app/ runs Tauri CLI commands)
- `npm run dev` (in website/ runs Next.js dev server)
- `npm run build` (in website/ builds Next.js site)
- `npm run start` (in website/ starts Next.js production server)

No Makefile targets detected.

## Architecture
- Root workspace manages two git submodules: `app/` and `website/`.
- `app/` is the Tauri desktop app combining Rust backend and React frontend.
  - Rust backend in `app/src-tauri/src/` handles commands, projects, servers, SSH, CMDOP integration.
  - React frontend in `app/src/` uses Zustand for state, dnd-kit for drag-drop, and Tauri APIs.
  - Entry point: `app/src/main.tsx` renders `<App />` component.
  - Tauri config in `app/src-tauri/tauri.conf.json` defines window and build.
- `website/` is a Next.js React website for marketing or documentation.
- Data flow:
  - Frontend React invokes backend Rust commands via Tauri invoke handlers.
  - Backend manages projects, servers, prompts, tasks stored in app data directory.
  - CMDOP integration uses HTTP plugin and OAuth device code flow.

## Workflow

*   Before starting complex tasks, check `.claude/plans/` for existing plans and save new plans there
*   Periodically use `sidecar_tasks` MCP tool to check pending tasks (do NOT use built-in TaskList — it is unrelated)
*   Sidecar MCP tools (`sidecar_tasks`, `sidecar_scan`, `sidecar_map`, `sidecar_add_rule`, `docs_search`, `docs_get`, `docs_list`, `docs_reindex`, `mcp_list_servers`, `changelog_list`, `changelog_get`) are called directly — they are NOT deferred tools, do NOT search for them via ToolSearch
*   After major changes, use sidecar tools: `sidecar_scan` to review docs, `sidecar_map` to update project map
*   Read `.claude/rules/` for project-specific coding guidelines before making changes
*   Use `sidecar_add_rule` to persist discovered coding patterns to `.claude/rules/`
*   Keep CLAUDE.md under 200 lines — move detailed rules to `.claude/rules/*.md`
*   When working with external APIs, databases, browsers, or new tools — check if a relevant MCP plugin exists: use `mcp_list_servers` to see what's configured, or `sidecar_tasks` to browse plugins via `make -C .claude dashboard` (Plugin Browser tab)
*   Changelog files live in `.claude/changelog/` — use `/commit` skill on every release (writes `.claude/changelog/vX.Y.Z.md`, bumps version, commits, tags)
*   Use `docs_search` to find relevant guides in: cmdop-claude bundled docs. Call `docs_get` with the returned path to read the full file.
## Key Rules
- Use Tauri's `invoke` commands defined in `app/src-tauri/src/lib.rs` to communicate between frontend and backend.
- Manage project and server data with Rust structs in `app/src-tauri/src/projects.rs` and `servers.rs`, persisting JSON in app data dir.
- Use Zustand store in `app/src/stores/store.ts` (implied) for React state management, as seen in `app/src/App.tsx`.
- Implement drag-and-drop reorder with `@dnd-kit` libraries as declared in `app/package.json`.
- Use Tailwind CSS with Vite plugin for styling, configured in `app/vite.config.ts` and `tailwind.config.js`.
- Authenticate CMDOP API via OAuth device code flow in `app/src/utils/cmdopAuth.ts` and fetch machines with `cmdopApi.ts`.
- Separate Rust backend logic into modules: `cmdop.rs`, `projects.rs`, `prompts.rs`, `servers.rs`, `ssh.rs`, and `tasks.rs`.
- Frontend React entry point is `app/src/main.tsx` rendering `<App />` which manages UI modals and terminal panes.
- Website uses Next.js with environment variable `NEXT_PUBLIC_APP_VERSION` set from root version file.

---

# .claude/rules/tauri.md

# Tauri Backend and Frontend Integration Rules

This project uses Tauri to combine a Rust backend with a React frontend.

- All backend commands callable from the frontend are defined with `#[tauri::command]` in `app/src-tauri/src/lib.rs`.
- Backend modules are organized by domain: `cmdop.rs`, `projects.rs`, `prompts.rs`, `servers.rs`, `ssh.rs`, and `tasks.rs`.
- Use `tauri::Builder` with plugins for shell, pty, http, and dialog as configured in `lib.rs`.
- The backend persists data as JSON files in the app data directory, created on demand (see `servers.rs`, `prompts.rs`, `tasks.rs`).
- The frontend calls backend commands using Tauri's `invoke` API, e.g. `invoke<Project[]>("get_projects")` in `app/src/App.tsx`.
- The Tauri config file `app/src-tauri/tauri.conf.json` defines window properties and build commands.
- Use `tauri_plugin_pty` to manage terminal sessions, as seen in `cmdop.rs` and frontend terminal components.
- The Rust backend entry point is `app/src-tauri/src/main.rs` which calls `open_agent_manager_lib::run()`.

# .claude/rules/react.md

# React Frontend and State Management Rules

- The React app entry is `app/src/main.tsx`, rendering `<App />` from `app/src/App.tsx`.
- Use Zustand for global state management, accessed via `useStore` in `App.tsx`.
- UI components include `Sidebar`, `TerminalPane`, `PromptQueue`, and modals like `AddProjectModal`.
- Drag-and-drop functionality uses `@dnd-kit/core`, `@dnd-kit/sortable`, and modifiers as dependencies.
- Styling uses Tailwind CSS with the `@tailwindcss/vite` plugin.
- Use React 19 with JSX transform `react-jsx` as configured in `app/tsconfig.json`.
- Versioning is injected into the build via `__APP_VERSION__` defined in `app/vite.config.ts`.
- Use Tauri APIs (`@tauri-apps/api`) for native dialogs, HTTP requests, and shell commands.

# .claude/rules/cmdop.md

# CMDOP API Integration Rules

- Authenticate using OAuth device code flow implemented in `app/src/utils/cmdopAuth.ts`.
- Use Tauri's HTTP plugin (`@tauri-apps/plugin-http`) for API requests to bypass CORS.
- Refresh tokens and manage access tokens carefully; `listMachines` in `cmdopApi.ts` handles token refresh and callbacks.
- CMDOP machine and session data are modeled with Rust structs in `cmdop.rs` and TypeScript interfaces in `app/src/types.ts`.
- Backend spawns and manages CMDOP agent processes with separate stdin handling for input streaming.
- Frontend components interact with CMDOP sessions via Tauri commands exposed in `lib.rs`.
- Securely store tokens and refresh them only on successful API calls to avoid infinite loops.
- Use `@cmdop/node` and `@cmdop/react` packages in the frontend as dependencies for CMDOP client features.
