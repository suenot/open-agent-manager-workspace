# Terminal Resize Implementation

## Problem

When the application window is resized, the embedded xterm.js terminal experiences two issues:

1. **Scroll position jumps** to the top/middle instead of staying at the bottom
2. **Visual flicker** — user sees the terminal content at the wrong scroll position before it snaps back

## Root Cause Analysis

### xterm.js Reflow

When `fitAddon.fit()` is called, it internally calls `terminal.resize(cols, rows)`. If the column count changes, xterm.js triggers a **line reflow** — all lines in the scrollback buffer are re-wrapped to fit the new width. During reflow, `ydisp` (the internal viewport scroll position) is reset, causing the terminal to display content from the top/middle of the buffer.

### PTY Response

After `pty.resize(cols, rows)`, the shell (bash/zsh/Claude) sends escape sequences in response (e.g., redrawing the prompt, status bar). These arrive via `pty.onData()` → `terminal.write()`, which can move the viewport to wherever the cursor is — often overriding any `scrollToBottom()` call that happened before the data arrived.

### WKWebView vs Chrome

`scrollToBottom()` works correctly in Chrome after `fit()`. However, in Tauri's WKWebView (macOS), the viewport scroll sync behaves differently. Testing confirmed:

- **Standalone test** (no PTY, same CSS/layout): `scrollToBottom()` works perfectly in both Chrome and WKWebView
- **With PTY**: scroll jumps because PTY response data arrives asynchronously and moves the viewport

This proved the issue is not in xterm.js or WKWebView — it's the timing between `fit()`, `pty.resize()`, PTY response data, and `scrollToBottom()`.

## Solution

### Architecture

```
ResizeObserver fires
    |
    v
200ms debounce (coalesce rapid resize events)
    |
    v
1. visibility: hidden  (hide terminal to prevent visual jump)
2. fitAddon.fit()       (reflow lines — ydisp gets reset internally)
3. pty.resize()         (tell shell about new dimensions)
    |
    v
500ms delay (wait for PTY escape sequences to be written)
    |
    v
4. terminal.scrollToBottom()  (scroll to bottom of buffer)
5. visibility: ''             (show terminal at correct position)
```

### Key Design Decisions

**Why `visibility: hidden` instead of `overflow: hidden`?**
xterm.js renders via canvas, which draws based on `ydisp` — not CSS `scrollTop`. Setting `overflow: hidden` on the viewport div only hides the scrollbar but doesn't prevent the canvas from rendering at the wrong position. `visibility: hidden` hides the entire element while preserving layout.

**Why 500ms delay?**
PTY escape sequences (prompt redraws, status updates) can arrive over multiple chunks. 500ms gives enough time for typical shell responses. This was determined empirically — shorter delays (100-200ms) were insufficient.

**Why 200ms debounce?**
During window drag-resize, `ResizeObserver` fires every frame (~16ms). Without debounce, `fit()` would be called dozens of times. The 200ms debounce ensures `fit()` runs once after the resize gesture settles.

**Why not preserve scroll position?**
Multiple approaches were tried and failed:
- **Distance from bottom** (`baseY - viewportY`): Incorrect after reflow because `baseY` changes
- **Scroll ratio** (`viewportY / baseY`): Inaccurate when line wrapping changes non-uniformly
- **DOM scrollTop ratio**: xterm's async viewport sync overrides it
- **Multiple delayed `scrollToLine()` calls**: Overridden by PTY data writes

Scrolling to bottom is the pragmatic choice — it's where the user typically wants to be during active terminal sessions.

**Why remove the separate `window.addEventListener('resize')` handler?**
`ResizeObserver` already handles container size changes caused by window resize. Having both creates double-trigger conflicts where the second handler's `fit()` resets scroll set by the first.

## Files

- `app/src/components/Terminal/TerminalPane.tsx` — Local terminal resize logic
- `app/src/components/Terminal/RemoteTerminalPane.tsx` — Remote terminal resize logic
- `app/src/index.css` — Terminal container CSS (padding on container, no overflow override on viewport)

## CSS Constraints

```css
/* Padding on outer container — FitAddon accounts for it in column calculation */
.terminal-container { padding-left: 12px; }

/* Do NOT set overflow-y on .xterm-viewport — xterm.js manages it internally.
   Overriding it breaks scrollToBottom() and syncScrollArea(). */
```

## Testing

A standalone test page (`app/test-xterm.html`) was created to isolate xterm.js behavior from the PTY/React/Tauri stack. It confirmed that `scrollToBottom()` works correctly in both Chrome and WKWebView when no PTY is involved.

To run:
```bash
cd app
python3 -m http.server 8765
# Open http://localhost:8765/test-xterm.html
```

## Future Improvements

- Reduce the 500ms delay by detecting when PTY response is complete (idle detection)
- Use `opacity` transition instead of `visibility` toggle for smoother visual
- Investigate xterm.js `_core` private API for direct `ydisp` manipulation after reflow
