# Parda

A stealth transparent note-taking overlay for Windows 10/11 and Windows Server 2022+.

Built with Electron. Features a click-through always-on-top translucent window with blur effect that sits over your desktop — visible to you but **invisible to screen capture** (protected via `SetWindowDisplayAffinity`).

## Features

- **Always-on-top** transparent blur overlay
- **Click-through mode** — mouse passes through to underlying windows
- **Screen capture protection** — Parda won't appear in screen shares or recordings (Win32 `WDA_EXCLUDEFROMCAPTURE`)
- **Auto-saving** — notes persist across sessions
- **Global hotkeys**

## Hotkeys

| Key | Action |
|---|---|
| `Ctrl+Shift+P` | Show / hide |
| `Ctrl+Shift+I` | Toggle click-through / interactive mode |
| `Ctrl+Shift+H` | Toggle screen capture protection |
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
