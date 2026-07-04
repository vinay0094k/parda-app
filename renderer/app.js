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
const dragHandle = document.getElementById('drag-handle')

let isClickThrough = true
let isCaptureProtected = true
let isListening = false
let animationFrameId = null
let waveformPhase = 0
let dragging = false
let dragStartX = 0
let dragStartY = 0
let dragStartWinX = 0
let dragStartWinY = 0

// OpenAI API configuration
const getAPIKey = () => {
  // Check localStorage first (user-configured)
  const stored = localStorage.getItem('openai_api_key')
  if (stored) {
    console.log('[Parda] Using API key from localStorage')
    return stored
  }
  // Fall back to config file (pre-configured for build)
  const configKey = window.__appConfig?.openai_api_key || ''
  if (configKey) {
    console.log('[Parda] Using API key from config file')
  } else {
    console.log('[Parda] No API key found in localStorage or config')
  }
  return configKey
}

let cachedSystemPrompt = null

const getSystemPrompt = async () => {
  if (cachedSystemPrompt) return cachedSystemPrompt
  try {
    cachedSystemPrompt = await window.parda.getSystemPrompt()
    return cachedSystemPrompt
  } catch (e) {
    console.error('Failed to load system prompt:', e)
    return 'You are a helpful DevOps interview coach providing practical, production-focused answers.'
  }
}

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const speechSynthesis = window.speechSynthesis

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

async function sendMessage() {
  const text = messageInput.value.trim()
  if (!text) return

  responseText.textContent = text
  responseAvatar.textContent = '👤'
  responseSection.querySelector('#response-message').classList.remove('response-empty')

  messageInput.value = ''
  messageInput.focus()

  setListening(true)

  try {
    const apiKey = getAPIKey()
    if (!apiKey) {
      throw new Error('OpenAI API key not set. Please set your API key when prompted.')
    }

    const systemPrompt = await getSystemPrompt()

    const payload = {
      model: window.__appConfig?.model || 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: window.__appConfig?.max_tokens || 150
    }

    // Only add temperature if specified in config (not all models support it)
    if (window.__appConfig?.temperature !== undefined) {
      payload.temperature = window.__appConfig.temperature
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const aiResponse = data.choices[0].message.content

    responseText.textContent = aiResponse
    responseAvatar.textContent = '🤖'

    // Speak the response
    speakText(aiResponse)
  } catch (error) {
    console.error('Error:', error)
    responseText.textContent = `Error: ${error.message}`
    responseAvatar.textContent = '⚠️'
  } finally {
    setListening(false)
  }
}

function speakText(text) {
  if (!speechSynthesis) return

  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.0
  utterance.pitch = 1.0
  utterance.volume = 1.0
  speechSynthesis.speak(utterance)
}

function startVoiceInput() {
  if (!SpeechRecognition) {
    alert('Speech Recognition not supported in your browser')
    return
  }

  const recognition = new SpeechRecognition()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = 'en-US'

  recognition.onstart = () => {
    setListening(true)
    messageInput.value = ''
  }

  recognition.onresult = (event) => {
    let interimTranscript = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i].transcript
      if (event.results[i].isFinal) {
        messageInput.value = transcript
      } else {
        interimTranscript += transcript
      }
    }
  }

  recognition.onend = () => {
    setListening(false)
    if (messageInput.value.trim()) {
      sendMessage()
    }
  }

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error)
    setListening(false)
  }

  recognition.start()
}

sendBtn.addEventListener('click', () => {
  if (messageInput.value.trim()) {
    sendMessage()
  } else {
    startVoiceInput()
  }
})

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

// Drag handle for moving window (only in interactive mode)
dragHandle.addEventListener('mousedown', (e) => {
  if (isClickThrough) return
  dragging = true
  dragStartX = e.screenX
  dragStartY = e.screenY
  dragStartWinX = window.screenX
  dragStartWinY = window.screenY
  dragHandle.classList.add('dragging')
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!dragging) {
    if (!isClickThrough) {
      dragHandle.classList.add('draggable')
    } else {
      dragHandle.classList.remove('draggable')
    }
    return
  }
  const dx = e.screenX - dragStartX
  const dy = e.screenY - dragStartY
  window.parda.moveWindow(dragStartWinX + dx, dragStartWinY + dy)
})

document.addEventListener('mouseup', () => {
  if (dragging) {
    dragging = false
    dragHandle.classList.remove('dragging')
  }
})

window.parda.onClickThroughChanged((val) => {
  isClickThrough = val
  updateUI()
  if (val) {
    dragHandle.classList.remove('draggable', 'dragging')
  }
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

// Load config from build
async function loadAppConfig() {
  try {
    const config = await window.parda.getApiConfig()
    window.__appConfig = config
    console.log('[Parda] Config loaded:', {
      hasApiKey: !!config.openai_api_key,
      model: config.model,
      maxTokens: config.max_tokens
    })
  } catch (e) {
    console.error('[Parda] Failed to load app config:', e)
    window.__appConfig = {}
  }
}

// Check API key on startup
function checkAndSetupAPIKey() {
  if (!getAPIKey()) {
    const userKey = prompt('Enter your OpenAI API key:\n\n(This will be stored locally and used for API calls)', '')
    if (userKey && userKey.trim()) {
      localStorage.setItem('openai_api_key', userKey.trim())
      location.reload()
    }
  }
}

// Set initial UI state
updateUI()
updateShieldUI()

// Load app config and check API key on load
(async () => {
  await loadAppConfig()
  setTimeout(() => {
    if (!isClickThrough) {
      checkAndSetupAPIKey()
    }
  }, 500)
})()
