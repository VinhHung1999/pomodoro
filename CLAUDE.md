# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pomodo - A minimal desktop Pomodoro timer built with Electron and vanilla JavaScript. No framework, no bundler, no TypeScript.

## Commands

```bash
npm start          # Run app in dev mode (electron .)
npm run build      # Build macOS .app (electron-builder --mac, outputs to dist/mac-arm64/)
npm test           # Placeholder (no tests yet)
```

After building, the app is at `dist/mac-arm64/Pomodo.app`. Copy to `/Applications/` for installation.

Icon generation (requires Python 3 + Pillow): `python scripts/generate_icon.py`

## Architecture

Electron 3-file architecture with context isolation:

- **main.js** - Main process: window creation (400x520, non-resizable, hiddenInset titlebar), IPC handler for OS notifications
- **preload.js** - Security bridge: exposes `window.electronAPI.showNotification()` via contextBridge
- **src/renderer.js** - All UI logic: timer state machine, SVG ring progress, Web Audio bell, in-app toast notifications, keyboard shortcuts (Space=toggle, R=reset)

The renderer manages timer modes (pomodoro/shortBreak/longBreak) with auto-cycling: 4 pomodoros trigger a long break. Notifications are dual: in-app toast (always visible) + OS notification (visible when app unfocused, macOS limitation).

## Styling

CSS custom property `--accent` changes per mode via `body[data-mode]`:
- Pomodoro: `#e74c6f` (red)
- Short Break: `#4caf9e` (teal)
- Long Break: `#5b8cde` (blue)

## Key Constraints

- No production dependencies - fully self-contained
- macOS-first (build target: `dir` for ARM64)
- OS notifications only show when app is unfocused (macOS behavior) - in-app toast handles focused state
