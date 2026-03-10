# Pomodo

A minimal, beautiful desktop Pomodoro timer with an integrated Kanban board. Built with Electron and vanilla JavaScript — no frameworks, no bundlers.

![Pomodo Screenshot](./screenshots/app.png)

## Features

- **Pomodoro Timer** — 25min work / 5min short break / 15min long break with auto-cycling (4 pomodoros → long break)
- **Kanban Board** — Drag-and-drop task management with Obsidian-compatible markdown files
- **Inline Editing** — Double-click any card to edit instantly
- **Voice Commands** — Create, move, edit, and delete tasks by voice
- **Tags** — Organize tasks with `work` / `life` tags
- **Keyboard Shortcuts** — `Space` to start/pause, `R` to reset
- **Always-on-Top** — Keep the timer visible while you work
- **OS Notifications** — Get notified when a session ends

## Download

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Pomodo-1.0.0-arm64.dmg](https://github.com/VinhHung1999/pomodoro/releases/latest) |
| Windows | [Pomodo Setup 1.0.0.exe](https://github.com/VinhHung1999/pomodoro/releases/latest) |

## Development

```bash
npm install        # Install dependencies
npm start          # Run in dev mode
npm run build      # Build for macOS
npm run build:all  # Build for macOS + Windows
```

## Kanban Format

Pomodo reads and writes standard markdown files compatible with the [Obsidian Kanban plugin](https://github.com/mgmeyers/obsidian-kanban):

```markdown
---
kanban-plugin: board
---

## Todo
- [ ] [work] Build the feature
- [ ] [life] Buy groceries

## Doing

## Review

## Done
```

## License

MIT
