# Parda

A stealth transparent note-taking overlay for Windows 10/11 and Windows Server 2022+.

Built with Electron. Features a click-through always-on-top translucent window with blur effect that sits over your desktop — visible to you but **invisible to screen capture** (protected via `SetWindowDisplayAffinity`).

## Features

- **Always-on-top** transparent blur overlay
- **Click-through mode** — mouse passes through to underlying windows
- **Always-on screen capture protection** — Parda is invisible in screen shares and recordings (Win32 `WDA_EXCLUDEFROMCAPTURE`, no toggle needed)
- **Auto-saving** — notes persist across sessions
- **Global hotkeys**

## Hotkeys

| Key | Action |
|---|---|
| `Ctrl+Shift+P` | Show / hide |
| `Ctrl+Shift+I` | Toggle click-through / interactive mode |
| `Ctrl+Shift+Q` | Quit |

## Development

```bash
npm install
npm start
```

## Build

```bash
npm run build
```
