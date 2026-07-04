const messageInput = document.getElementById('message-input')
const sendBtn = document.getElementById('send-btn')
const lockBtn = document.getElementById('btn-lock')
const hideBtn = document.getElementById('btn-hide')
const shieldBtn = document.getElementById('btn-shield')
const lockIcon = document.getElementById('lock-icon')
const lockLabel = document.getElementById('lock-label')
const savedIndicator = document.getElementById('saved-indicator')
const listeningSection = document.getElementById('listening-section')
const responseSection = document.getElementById('response-section')
const responseText = document.getElementById('response-text')
const responseAvatar = document.getElementById('response-avatar')
const waveformCanvas = document.getElementById('waveform-canvas')
const ctx = waveformCanvas.getContext('2d')

let isClickThrough = true
let isCaptureProtected = true
let isListening = false
let animationFrameId = null
let waveformPhase = 0

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
    messageInput.disabled = true
    sendBtn.disabled = true
  } else {
    lockBtn.textContent = '🔒'
    lockIcon.textContent = '🔒'
    lockLabel.textContent = 'interactive'
    document.body.classList.add('interactive')
    messageInput.disabled = false
    sendBtn.disabled = false
    messageInput.focus()
  }
}

function updateShieldUI() {
  shieldBtn.classList.toggle('protected', isCaptureProtected)
  shieldBtn.classList.toggle('unprotected', !isCaptureProtected)
  shieldBtn.title = (isCaptureProtected ? 'Protected' : 'Unprotected') + ' from screen capture (Ctrl+Shift+H)'
}

function drawWaveform() {
  const width = waveformCanvas.width
  const height = waveformCanvas.height
  const centerY = height / 2

  ctx.fillStyle = 'rgba(10, 10, 20, 0.3)'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)'
  ctx.lineWidth = 1.5
  ctx.beginPath()

  const bars = 60
  const barWidth = width / bars

  for (let i = 0; i < bars; i++) {
    const phase = (waveformPhase + i * 0.1) % (Math.PI * 2)
    const amplitude = (Math.sin(phase) * 0.5 + 0.5) * (centerY * 0.7)
    const x = i * barWidth + barWidth / 2

    ctx.moveTo(x, centerY - amplitude)
    ctx.lineTo(x, centerY + amplitude)
  }

  ctx.stroke()
  waveformPhase += 0.05
}

function animateWaveform() {
  if (isListening) {
    drawWaveform()
    animationFrameId = requestAnimationFrame(animateWaveform)
  }
}

function setListening(state) {
  isListening = state
  if (state) {
    listeningSection.classList.remove('section-hidden')
    waveformCanvas.width = waveformCanvas.offsetWidth
    waveformCanvas.height = waveformCanvas.offsetHeight
    animateWaveform()
  } else {
    listeningSection.classList.add('section-hidden')
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
  }
}

function sendMessage() {
  const text = messageInput.value.trim()
  if (!text) return

  responseText.textContent = text
  responseAvatar.textContent = '👤'
  responseSection.querySelector('#response-message').classList.remove('response-empty')

  messageInput.value = ''
  messageInput.focus()

  setListening(true)
  setTimeout(() => {
    const responses = [
      'Got it. Let me process that.',
      'That\'s helpful information.',
      'I\'m analyzing your request.',
      'Processing complete.',
      'Ready for more.'
    ]
    const response = responses[Math.floor(Math.random() * responses.length)]
    responseText.textContent = response
    responseAvatar.textContent = '🤖'
    setListening(false)
  }, 2000)
}

sendBtn.addEventListener('click', sendMessage)
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage()
  }
})

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

// Set initial UI state
updateUI()
updateShieldUI()
