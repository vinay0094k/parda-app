const noteInput = document.getElementById('note-input')
const lockBtn = document.getElementById('btn-lock')
const hideBtn = document.getElementById('btn-hide')
const shieldBtn = document.getElementById('btn-shield')
const lockIcon = document.getElementById('lock-icon')
const lockLabel = document.getElementById('lock-label')
const savedIndicator = document.getElementById('saved-indicator')

let saveTimer = null
let isClickThrough = true
let isCaptureProtected = true

window.parda.getNotes().then((content) => {
  if (content) {
    noteInput.value = content
  }
})

window.parda.getClickThrough().then((val) => {
  isClickThrough = val
  updateUI()
})

window.parda.getCaptureProtection().then((val) => {
  isCaptureProtected = val
  updateShieldUI()
})

function updateUI() {
  if (isClickThrough) {
    lockBtn.textContent = '🔓'
    lockIcon.textContent = '🔓'
    lockLabel.textContent = 'click-through'
    document.body.classList.remove('interactive')
    noteInput.disabled = true
  } else {
    lockBtn.textContent = '🔒'
    lockIcon.textContent = '🔒'
    lockLabel.textContent = 'interactive'
    document.body.classList.add('interactive')
    noteInput.disabled = false
    noteInput.focus()
  }
}

function updateShieldUI() {
  shieldBtn.classList.toggle('protected', isCaptureProtected)
  shieldBtn.classList.toggle('unprotected', !isCaptureProtected)
  shieldBtn.title = (isCaptureProtected ? 'Protected' : 'Unprotected') + ' from screen capture (Ctrl+Shift+H)'
}

function saveNotes() {
  savedIndicator.textContent = 'saving...'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    window.parda.saveNotes(noteInput.value)
    savedIndicator.textContent = 'saved'
    setTimeout(() => { savedIndicator.textContent = '' }, 1500)
  }, 400)
}

noteInput.addEventListener('input', saveNotes)

lockBtn.addEventListener('click', () => {
  window.parda.toggleClickThrough()
})

shieldBtn.addEventListener('click', () => {
  window.parda.toggleCaptureProtection()
})

hideBtn.addEventListener('click', () => {
  window.parda.hideWindow()
})

window.parda.onClickThroughChanged((val) => {
  isClickThrough = val
  updateUI()
})

window.parda.onCaptureProtectionChanged((val) => {
  isCaptureProtected = val
  updateShieldUI()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !isClickThrough) {
    window.parda.toggleClickThrough()
  }
})

// Custom resize handle
const resizeHandle = document.getElementById('resize-handle')
let resizing = false
let startX, startY, startW, startH

resizeHandle.addEventListener('mousedown', (e) => {
  if (isClickThrough) return
  resizing = true
  startX = e.screenX
  startY = e.screenY
  startW = window.innerWidth
  startH = window.innerHeight
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!resizing) return
  const dw = e.screenX - startX
  const dh = e.screenY - startY
  window.parda.resizeWindow(Math.max(240, startW + dw), Math.max(160, startH + dh))
})

document.addEventListener('mouseup', () => {
  resizing = false
})
