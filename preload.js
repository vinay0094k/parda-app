const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('parda', {
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNotes: (content) => ipcRenderer.invoke('save-notes', content),
  getClickThrough: () => ipcRenderer.invoke('get-click-through'),
  toggleClickThrough: () => ipcRenderer.invoke('toggle-click-through'),
  onToggleUi: (cb) => {
    ipcRenderer.on('toggle-ui-mode', () => cb())
  },
  onClickThroughChanged: (cb) => {
    ipcRenderer.on('click-through-changed', (_, val) => cb(val))
  },
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  toggleCaptureProtection: () => ipcRenderer.invoke('toggle-capture-protection'),
  getCaptureProtection: () => ipcRenderer.invoke('get-capture-protection'),
  onCaptureProtectionChanged: (cb) => {
    ipcRenderer.on('capture-protection-changed', (_, val) => cb(val))
  },
  resizeWindow: (w, h) => ipcRenderer.invoke('resize-window', w, h),
  moveWindow: (x, y) => ipcRenderer.invoke('move-window', x, y),
  getSystemPrompt: () => ipcRenderer.invoke('get-system-prompt'),
  getApiConfig: () => ipcRenderer.invoke('get-api-config'),
  getOpacity: () => ipcRenderer.invoke('get-opacity'),
  setOpacity: (val) => ipcRenderer.invoke('set-opacity', val),
  onOpacityChanged: (cb) => {
    ipcRenderer.on('opacity-changed', (_, val) => cb(val))
  }
})
