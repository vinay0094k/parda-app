const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const DEF_OPACITY = 0.75

// Capture protection via Win32 SetWindowDisplayAffinity
const CAPTURE_API = initCaptureProtection()
const WDA_EXCLUDEFROMCAPTURE = 0x00000011
const WDA_NONE = 0
let captureProtectionEnabled = true

function initCaptureProtection() {
  if (process.platform !== 'win32') return null
  try {
    const koffi = require('koffi')
    const lib = koffi.load('user32.dll')
    const func = lib.func('SetWindowDisplayAffinity', 'bool', ['intptr', 'uint32'])
    return { lib, func }
  } catch (e) {
    console.error('[parda] Capture protection init failed:', e.message)
    return null
  }
}

function getHwndPtr(buf) {
  return process.arch === 'x64' ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0)
}

function applyCaptureProtection(hwndBuf) {
  if (!CAPTURE_API) return false
  try {
    const dwAffinity = captureProtectionEnabled ? WDA_EXCLUDEFROMCAPTURE : WDA_NONE
    return CAPTURE_API.func(getHwndPtr(hwndBuf), dwAffinity)
  } catch (e) {
    console.error('[parda] applyCaptureProtection failed:', e.message)
    return false
  }
}

function toggleCaptureProtection() {
  captureProtectionEnabled = !captureProtectionEnabled
  if (win) {
    applyCaptureProtection(win.getNativeWindowHandle())
  }
  return captureProtectionEnabled
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
    applyCaptureProtection(win.getNativeWindowHandle())
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
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    const enabled = toggleCaptureProtection()
    if (win) win.webContents.send('capture-protection-changed', enabled)
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
ipcMain.handle('toggle-capture-protection', () => {
  const enabled = toggleCaptureProtection()
  return enabled
})
ipcMain.handle('get-capture-protection', () => captureProtectionEnabled)

ipcMain.handle('get-system-prompt', () => {
  try {
    const promptPath = path.join(__dirname, 'prompts', 'system-prompt.md')
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, 'utf-8')
    }
  } catch (e) {
    console.error('[parda] Failed to load system prompt:', e.message)
  }
  return 'You are a helpful DevOps and cloud engineering interview coach. Provide practical, production-focused answers with real-world scenarios and technical depth.'
})

ipcMain.handle('get-api-config', () => {
  try {
    const configPath = path.join(__dirname, 'config', 'api-config.json')
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (e) {
    console.error('[parda] Failed to load API config:', e.message)
  }
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
