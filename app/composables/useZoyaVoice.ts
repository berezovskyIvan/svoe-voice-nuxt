import type {
  AssistantResponse,
  VoiceDockState,
  WsVoiceIncomingMessage,
} from '@/types/zoya'

interface UseZoyaVoiceOptions {
  onResult: (response: AssistantResponse) => void
}

export function useZoyaVoice(options: UseZoyaVoiceOptions) {
  const config = useRuntimeConfig()
  const baseURL = config.public.zoyaApiBase

  const dockState = ref<VoiceDockState>('IDLE')
  const liveTranscript = ref<string>('')
  const errorMessage = ref<string>('')
  const volume = ref<number>(0)

  let socket: WebSocket | null = null
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let processorNode: ScriptProcessorNode | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null

  let isReadyToStream = false
  let hasSpoken = false
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let autoStopTimer: ReturnType<typeof setTimeout> | null = null

  const TARGET_SAMPLE_RATE = 16000
  const SILENCE_THRESHOLD = 0.015
  const SILENCE_DELAY_MS = 1500
  const AUTO_STOP_MS = 2000

  function buildWsUrl(): string {
    const url = new URL('/api/assistant/voice', baseURL)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
  }

  function downsampleToInt16(input: Float32Array, inputSampleRate: number): ArrayBuffer {
    if (inputSampleRate === TARGET_SAMPLE_RATE) {
      const buffer = new ArrayBuffer(input.length * 2)
      const view = new DataView(buffer)
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i] ?? 0))
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      }
      return buffer
    }

    const ratio = inputSampleRate / TARGET_SAMPLE_RATE
    const newLength = Math.round(input.length / ratio)
    const buffer = new ArrayBuffer(newLength * 2)
    const view = new DataView(buffer)

    let offsetResult = 0
    let offsetBuffer = 0

    while (offsetResult < newLength) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
      let accum = 0
      let count = 0

      for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
        accum += input[i] ?? 0
        count++
      }

      const sample = count > 0 ? accum / count : 0
      const clamped = Math.max(-1, Math.min(1, sample))
      view.setInt16(
        offsetResult * 2,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true,
      )

      offsetResult++
      offsetBuffer = nextOffsetBuffer
    }

    return buffer
  }

  function clearTimers() {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    if (autoStopTimer) {
      clearTimeout(autoStopTimer)
      autoStopTimer = null
    }
  }

  function stopAudioCapture() {
    clearTimers()
    volume.value = 0
    isReadyToStream = false

    if (processorNode) {
      processorNode.disconnect()
      processorNode.onaudioprocess = null
      processorNode = null
    }
    if (sourceNode) {
      sourceNode.disconnect()
      sourceNode = null
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {})
      audioContext = null
    }
  }

  function cleanupAll() {
    stopAudioCapture()
    if (socket) {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close()
      }
      socket = null
    }
  }

  function handleSpeechActivity(rms: number) {
    if (rms > SILENCE_THRESHOLD) {
      hasSpoken = true
      if (dockState.value === 'PAUSED_2S') {
        dockState.value = 'LISTENING'
      }
      clearTimers()

      silenceTimer = setTimeout(() => {
        if (dockState.value !== 'LISTENING') return
        dockState.value = 'PAUSED_2S'

        autoStopTimer = setTimeout(() => {
          stopAndSend()
        }, AUTO_STOP_MS)
      }, SILENCE_DELAY_MS)
    }
  }

  async function startRecording() {
    if (
      dockState.value === 'LISTENING' ||
      dockState.value === 'PAUSED_2S' ||
      dockState.value === 'PROCESSING'
    ) {
      return
    }

    cleanupAll()
    liveTranscript.value = ''
    errorMessage.value = ''
    hasSpoken = false

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch {
      dockState.value = 'NO_PERMISSION'
      errorMessage.value = 'Нет доступа к микрофону. Разрешите доступ в браузере.'
      return
    }

    try {
      socket = new WebSocket(buildWsUrl())
      socket.binaryType = 'arraybuffer'
    } catch {
      stopAudioCapture()
      dockState.value = 'ERROR'
      errorMessage.value = 'Не удалось открыть голосовое соединение.'
      return
    }

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return

      let msg: WsVoiceIncomingMessage
      try {
        msg = JSON.parse(event.data) as WsVoiceIncomingMessage
      } catch {
        return
      }

      if (msg.type === 'ready') {
        isReadyToStream = true
        dockState.value = 'LISTENING'

        silenceTimer = setTimeout(() => {
          if (!hasSpoken && !liveTranscript.value.trim()) {
            cancelRecording()
            dockState.value = 'ERROR'
            errorMessage.value = 'Не расслышал. Повторите, пожалуйста'
          }
        }, SILENCE_DELAY_MS + AUTO_STOP_MS)
      } else if (msg.type === 'partial' || msg.type === 'transcript') {
        liveTranscript.value = msg.text
        if (msg.text.trim().length > 0) {
          hasSpoken = true
        }
      } else if (msg.type === 'result') {
        cleanupAll()
        dockState.value = 'IDLE'
        const resultPayload =
          'data' in msg && msg.data ? msg.data : (msg as unknown as AssistantResponse)
        options.onResult(resultPayload)
      } else if (msg.type === 'error') {
        cleanupAll()
        dockState.value = 'ERROR'
        errorMessage.value = msg.message || 'Не расслышал. Повторите, пожалуйста'
      }
    }

    socket.onerror = () => {
      cleanupAll()
      dockState.value = 'ERROR'
      errorMessage.value = 'Ошибка голосового соединения. Попробуйте текстом.'
    }

    socket.onclose = () => {
      if (dockState.value === 'PROCESSING') {
        dockState.value = 'ERROR'
        errorMessage.value = 'Соединение прервано до получения ответа.'
      }
      stopAudioCapture()
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    audioContext = new AudioCtx()
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    sourceNode = audioContext.createMediaStreamSource(mediaStream)
    processorNode = audioContext.createScriptProcessor(4096, 1, 1)

    processorNode.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0)

      let sumSquares = 0
      for (let i = 0; i < inputData.length; i++) {
        const v = inputData[i] ?? 0
        sumSquares += v * v
      }
      const rms = Math.sqrt(sumSquares / inputData.length)
      volume.value = Math.min(1, rms * 6)

      handleSpeechActivity(rms)

      if (isReadyToStream && socket && socket.readyState === WebSocket.OPEN) {
        const pcmChunk = downsampleToInt16(inputData, audioContext!.sampleRate)
        socket.send(pcmChunk)
      }
    }

    sourceNode.connect(processorNode)
    processorNode.connect(audioContext.destination)
  }

  function stopAndSend() {
    if (dockState.value !== 'LISTENING' && dockState.value !== 'PAUSED_2S') {
      return
    }

    if (!hasSpoken && !liveTranscript.value.trim()) {
      cancelRecording()
      dockState.value = 'ERROR'
      errorMessage.value = 'Не расслышал. Повторите, пожалуйста'
      return
    }

    stopAudioCapture()
    dockState.value = 'PROCESSING'

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'stop' }))
    } else {
      dockState.value = 'ERROR'
      errorMessage.value = 'Соединение потеряно. Попробуйте ещё раз.'
    }
  }

  function cancelRecording() {
    cleanupAll()
    liveTranscript.value = ''
    errorMessage.value = ''
    dockState.value = 'IDLE'
  }

  function resetError() {
    if (dockState.value === 'ERROR' || dockState.value === 'NO_PERMISSION') {
      errorMessage.value = ''
      dockState.value = 'IDLE'
    }
  }

  onUnmounted(() => {
    cleanupAll()
  })

  return {
    dockState,
    liveTranscript,
    errorMessage,
    volume,
    startRecording,
    stopAndSend,
    cancelRecording,
    resetError,
  }
}
