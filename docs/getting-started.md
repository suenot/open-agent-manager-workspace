# Getting Started

## Prerequisites

- **Node.js** >= 20
- **Rust** (stable toolchain) -- install via [rustup](https://rustup.rs/)
- **Tauri 2 prerequisites** -- see [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)
  - macOS: Xcode Command Line Tools
  - Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libgtk-3-dev`
  - Windows: Visual Studio Build Tools, WebView2
- **Python 3** (optional, only needed for CMDOP remote features)
- **tmux** (optional, for tmux session wrapping)

## Clone the Repository

```bash
git clone --recurse-submodules git@github.com:suenot/open-agent-manager.git
cd open-agent-manager
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## Install Dependencies

```bash
# Root workspace (sharp for image processing)
npm install

# Frontend dependencies
cd app
npm install
```

## Development

### Run the Tauri Desktop App

From the `app/` directory:

```bash
npm run tauri dev
```

This will:
1. Start the Vite dev server on `http://localhost:1420`
2. Compile the Rust backend
3. Open the native app window with hot-reload

DevTools open automatically in development mode.

### Run Only the Frontend (No Tauri)

```bash
cd app
npm run dev
```

The frontend runs at `http://localhost:1420`. Tauri invoke calls will fail without the native backend, but this is useful for UI-only work.

### Run the Website

```bash
cd website
npm install
npm run dev
```

The Next.js dev server starts on `http://localhost:3000`.

## Building for Production

### Desktop App

```bash
cd app
npm run tauri build
```

Build artifacts appear in `app/src-tauri/target/release/bundle/`:
- macOS: `.dmg` and `.app`
- Linux: `.deb` and `.AppImage`
- Windows: `.msi` and `.exe` (NSIS installer)

### Cross-platform Builds

For macOS, you can target specific architectures:

```bash
npm run tauri build -- --target aarch64-apple-darwin   # Apple Silicon
npm run tauri build -- --target x86_64-apple-darwin     # Intel
```

### Website

```bash
cd website
npm run build
npm run start   # production server
```

## Project Structure Quick Reference

| Path | Description |
|---|---|
| `app/src/` | React frontend source |
| `app/src/components/` | UI components (Sidebar, Terminal, PromptQueue, Settings, etc.) |
| `app/src/stores/store.ts` | Zustand global state |
| `app/src/types.ts` | TypeScript type definitions |
| `app/src/utils/` | CMDOP API client, auth, PTY registry |
| `app/src-tauri/src/` | Rust backend commands |
| `app/src-tauri/tauri.conf.json` | Tauri app configuration |
| `app/vite.config.ts` | Vite build configuration |
| `website/` | Next.js landing page |
| `scripts/release.sh` | Release automation script |
| `version` | Single source of truth for version number |
