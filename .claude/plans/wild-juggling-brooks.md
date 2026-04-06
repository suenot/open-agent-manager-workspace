# Fix xterm.js scroll position reset on resize

## Context
When the window is resized, xterm.js's `fit()` calls `terminal.resize()` which triggers internal line reflow. This reflow resets `ydisp` (viewport scroll position), causing the terminal to jump to the top/middle instead of staying at the current position or scrolling to bottom.

All previous attempts failed:
- `scrollToBottom()` after `fit()` — doesn't work (gets overridden)
- DOM `scrollTop` manipulation — overridden by xterm's sync
- Multiple delayed calls — first works, then breaks
- WebGL addon — didn't help
- Removing `overflow-y: auto` CSS — didn't help
- Re-entry guards — didn't help
- Confirmed: without fit(), scroll stays in place

## Plan

### Step 1: Create standalone test page
File: `app/test-xterm.html` (already created)
- Standalone xterm.js with 500 lines of content
- Logs before/after `fit()` and `scrollToBottom()` with timestamps
- Logs `baseY`, `viewportY`, `cols`, `rows` at each step
- Checks if scroll drifts after 200ms

### Step 2: Open test page in browser and resize
- Open `test-xterm.html` via Chrome DevTools MCP
- Scroll to middle of content  
- Resize the page using `resize_page` MCP tool
- Read logs to see exactly what happens to viewportY

### Step 3: Based on logs, determine the fix
Possible outcomes:
- **scrollToBottom works in test but not in app** → issue is in app-specific CSS/layout
- **scrollToBottom doesn't work in standalone test either** → issue is in xterm.js itself, need to use private API or patch
- **scroll drifts after delay** → async xterm sync overrides, need to hook into xterm's internal events

### Step 4: Implement the fix in TerminalPane.tsx and RemoteTerminalPane.tsx

### Step 5: Build and verify in the actual Tauri app

## Critical files
- `app/src/components/Terminal/TerminalPane.tsx` — local terminal resize logic
- `app/src/components/Terminal/RemoteTerminalPane.tsx` — remote terminal resize logic  
- `app/src/index.css` — terminal CSS overrides
- `app/test-xterm.html` — standalone test

## Verification
1. Open test-xterm.html, resize browser, check logs
2. Build Tauri app, resize window, verify scroll stays at bottom
3. Test with file browser toggle (Cmd+E)
