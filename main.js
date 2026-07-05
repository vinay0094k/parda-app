const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const DEF_OPACITY = 0.75

// Capture protection via PowerShell P/Invoke (no native modules required)
function enableCaptureProtection() {
  if (process.platform !== 'win32') {
    console.log('[parda] Capture protection skipped (non-Windows)')
    return
  }
  if (!win) {
    console.log('[parda] Capture protection skipped (no window)')
    return
  }
  try {
    const buf = win.getNativeWindowHandle()
    if (!buf || buf.length === 0) {
      console.log('[parda] Capture protection skipped (no handle)')
      return
    }
    const hwnd = process.arch === 'x64'
      ? buf.readBigUInt64LE(0).toString()
      : buf.readUInt32LE(0).toString()
    console.log('[parda] HWND:', hwnd)

    // Use single-quoted PowerShell string so double quotes inside C# are literal
    const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class P { [DllImport("user32.dll")] public static extern bool SetWindowDisplayAffinity(IntPtr h, uint a); }'; [P]::SetWindowDisplayAffinity([IntPtr]::new(${hwnd}), 0x11)`
    const encoded = Buffer.from(script, 'utf-16le').toString('base64')
    const result = execSync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      { timeout: 10000, encoding: 'utf-8' }
    ).trim()
    console.log('[parda] PowerShell result:', result || '(empty)')
  } catch (e) {
    console.error('[parda] PowerShell failed:', e.message)
    console.log('[parda] Trying Electron setContentProtection fallback...')
    try {
      if (win) {
        win.setContentProtection(true)
        console.log('[parda] Electron setContentProtection applied')
      }
    } catch (e2) {
      console.error('[parda] Electron fallback also failed:', e2.message)
    }
  }
}

// Detect Windows Server — use HW accel disable for compatibility
function isWindowsServer() {
  try {
    const { execSync } = require('child_process')
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ProductName',
      { timeout: 3000, encoding: 'utf-8' }
    )
    return out.includes('Server')
  } catch {}
  return false
}

const ON_SERVER = isWindowsServer()
const DISABLE_HW_ACCEL = ON_SERVER

if (DISABLE_HW_ACCEL) {
  app.disableHardwareAcceleration()
}

if (ON_SERVER) {
  console.log('[parda] Windows Server detected — hardware acceleration disabled for transparency compatibility')
}

const NOTES_PATH = path.join(app.getPath('userData'), 'notes.json')
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

let win
let isVisible = true
let isClickThrough = true

function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (e) {}
  return null
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8')
  } catch (e) {}
}

function getNotes() {
  return readJSON(NOTES_PATH) || ''
}

function saveNotes(content) {
  writeJSON(NOTES_PATH, content)
}

function getConfig() {
  return readJSON(CONFIG_PATH) || {}
}

function saveConfig(config) {
  writeJSON(CONFIG_PATH, config)
}

function toggleClickThrough() {
  isClickThrough = !isClickThrough
  win.setIgnoreMouseEvents(isClickThrough, { forward: true })
  win.webContents.send('click-through-changed', isClickThrough)
}

function toggleVisibility() {
  if (win.isVisible()) {
    win.hide()
  } else {
    win.showInactive()
  }
}

const MIN_W = 240
const MIN_H = 160
const DEF_W = 380
const DEF_H = 280

function createWindow() {
  const config = getConfig()
  const primDisplay = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = primDisplay.workAreaSize
  const w = Math.max(MIN_W, config.w ?? DEF_W)
  const h = Math.max(MIN_H, config.h ?? DEF_H)

  win = new BrowserWindow({
    width: w,
    height: h,
    x: config.x ?? sw - w - 20,
    y: config.y ?? 80,
    minWidth: MIN_W,
    minHeight: MIN_H,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  win.once('ready-to-show', () => {
    win.showInactive()
    win.setIgnoreMouseEvents(true, { forward: true })
    // Small delay to ensure window handle is fully initialized
    setTimeout(enableCaptureProtection, 500)
    win.webContents.send('opacity-changed', config.opacity ?? DEF_OPACITY)
  })

  const saveWinBounds = () => {
    const [x, y] = win.getPosition()
    const [w, h] = win.getSize()
    saveConfig({ x, y, w, h })
  }

  win.on('close', (e) => {
    if (app.isQuitting) return
    e.preventDefault()
    saveWinBounds()
    win.hide()
  })

  win.on('resize', saveWinBounds)
  win.on('move', saveWinBounds)
}

ipcMain.handle('resize-window', (_, w, h) => {
  if (win) {
    win.setSize(Math.max(MIN_W, w), Math.max(MIN_H, h))
  }
})

ipcMain.handle('move-window', (_, x, y) => {
  if (win) {
    win.setPosition(x, y)
  }
})

function registerHotkeys() {
  globalShortcut.register('CommandOrControl+Shift+P', toggleVisibility)
  globalShortcut.register('CommandOrControl+Shift+I', toggleClickThrough)
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.isQuitting = true
    app.quit()
  })
}

app.whenReady().then(() => {
  createWindow()
  registerHotkeys()
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('get-notes', () => getNotes())
ipcMain.handle('save-notes', (_, content) => saveNotes(content))
ipcMain.handle('get-click-through', () => isClickThrough)
ipcMain.handle('toggle-click-through', () => toggleClickThrough())
ipcMain.handle('hide-window', () => {
  win.hide()
})

function findResource(relativePath) {
  const candidates = [
    process.resourcesPath,
    path.dirname(app.getPath('exe')),
    __dirname
  ]
  for (const base of candidates) {
    if (!base) continue
    try {
      const p = path.join(base, relativePath)
      if (fs.existsSync(p)) return p
    } catch {}
  }
  return null
}

function readResourceFile(relativePath) {
  const p = findResource(relativePath)
  return p ? fs.readFileSync(p, 'utf-8') : null
}

function readResourceJSON(relativePath) {
  const content = readResourceFile(relativePath)
  return content ? JSON.parse(content) : null
}

ipcMain.handle('get-system-prompt', () => {
  const content = readResourceFile(path.join('prompts', 'system-prompt.md'))
  if (content) return content
  return 'You are a helpful DevOps and cloud engineering interview coach. Provide practical, production-focused answers with real-world scenarios and technical depth.'
})

ipcMain.handle('get-api-config', () => {
  const config = readResourceJSON(path.join('config', 'api-config.json'))
  if (config) return config
  return { openai_api_key: null }
})

ipcMain.handle('get-opacity', () => {
  return getConfig().opacity ?? DEF_OPACITY
})

ipcMain.handle('set-opacity', (_, val) => {
  const config = getConfig()
  config.opacity = val
  saveConfig(config)
  if (win) {
    win.webContents.send('opacity-changed', val)
  }
})
