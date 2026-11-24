<script setup lang="ts">
import type { VoiceDockState } from '@/types/zoya'

const props = defineProps<{
  state: VoiceDockState
  liveTranscript: string
  errorMessage: string
  volume: number
  isTextLoading?: boolean
  isVoiceMode?: boolean
}>()

const emit = defineEmits<{
  startVoice: []
  stopVoice: []
  cancelVoice: []
  resetError: []
  submitText: [text: string]
  'update:isVoiceMode': [val: boolean]
}>()

const textInput = ref('')
const isKeyboardOpen = ref(false)

const isRecordingActive = computed(
  () => props.state === 'LISTENING' || props.state === 'PAUSED_2S',
)

const showExpandedControls = computed(
  () => !isKeyboardOpen.value && (props.isVoiceMode || props.state !== 'IDLE'),
)

const waveBars = computed(() => {
  const pattern = [
    0.2, 0.35, 0.6, 0.4, 0.85, 0.5, 0.95, 0.7, 0.45, 1, 0.65, 0.9, 0.5, 0.8, 0.4, 0.65,
    0.35, 0.55, 0.3, 0.25, 0.2,
  ]
  return pattern.map((w) => {
    if (!isRecordingActive.value) {
      return '4px'
    }
    const h = Math.max(4, Math.min(34, Math.round(props.volume * w * 42)))
    return `${h}px`
  })
})

const statusTitle = computed(() => {
  switch (props.state) {
    case 'LISTENING':
      return 'Слушаю...'
    case 'PAUSED_2S':
      return 'Отправлю через 2 с...'
    case 'PROCESSING':
      return 'Распознаю команду...'
    case 'ERROR':
      return props.errorMessage || 'Не расслышал. Повторите, пожалуйста'
    case 'NO_PERMISSION':
      return 'Нет доступа к микрофону'
    default:
      return 'Нажмите и говорите'
  }
})

const bottomHint = computed(() => {
  switch (props.state) {
    case 'LISTENING':
      return 'Нажмите, чтобы закончить'
    case 'PAUSED_2S':
      return 'Продолжайте говорить, чтобы дополнить'
    case 'PROCESSING':
      return 'Обычно это 1–2 секунды'
    case 'ERROR':
      return 'Нажмите на кнопку, чтобы попробовать ещё раз'
    default:
      return 'Например: «Закажи молоко на субботу»'
  }
})

function handleMainCircleClick() {
  if (props.state === 'LISTENING' || props.state === 'PAUSED_2S') {
    emit('stopVoice')
  } else if (
    props.state === 'IDLE' ||
    props.state === 'ERROR' ||
    props.state === 'NO_PERMISSION'
  ) {
    isKeyboardOpen.value = false
    emit('update:isVoiceMode', true)
    emit('startVoice')
  }
}

function handleCancel() {
  emit('cancelVoice')
  emit('update:isVoiceMode', false)
  isKeyboardOpen.value = false
}

function switchToKeyboard() {
  if (isRecordingActive.value) {
    emit('cancelVoice')
  }
  emit('resetError')
  emit('update:isVoiceMode', false)
  isKeyboardOpen.value = true
}

function switchToVoiceFromInput() {
  isKeyboardOpen.value = false
  emit('update:isVoiceMode', true)
  emit('startVoice')
}

function handleTextSubmit() {
  const trimmed = textInput.value.trim()
  if (!trimmed || props.isTextLoading) {
    return
  }
  emit('submitText', trimmed)
  textInput.value = ''
  isKeyboardOpen.value = false
}
</script>

<template>
  <div class="voice-dock" :class="{ 'is-expanded': showExpandedControls }">
    <Transition name="fade">
      <div
        v-if="showExpandedControls && (liveTranscript || isRecordingActive)"
        class="live-speech-overlay"
      >
        <p class="live-speech-text">
          {{ liveTranscript }}
        </p>
      </div>
    </Transition>

    <div v-if="showExpandedControls" class="expanded-panel">
      <div class="wave-track">
        <span
          v-for="(h, idx) in waveBars"
          :key="idx"
          class="wave-dot"
          :class="{ 'is-active': isRecordingActive }"
          :style="{ height: h }"
        />
      </div>

      <p
        class="status-label"
        :class="{
          'is-green': state === 'LISTENING',
          'is-error': state === 'ERROR',
        }"
      >
        {{ statusTitle }}
      </p>

      <div class="controls-row">
        <button
          type="button"
          aria-label="Закрыть голосовой ввод"
          class="side-btn"
          @click="handleCancel"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <button
          type="button"
          :disabled="state === 'PROCESSING'"
          aria-label="Управление записью"
          class="center-btn"
          :class="[`state-${state.toLowerCase()}`]"
          @click="handleMainCircleClick"
        >
          <span
            v-if="state === 'PROCESSING' || state === 'PAUSED_2S'"
            class="ring-loader"
          />

          <svg
            v-if="state === 'LISTENING'"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="6" y="5" width="4" height="14" rx="1.5" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" />
          </svg>

          <svg
            v-else-if="state === 'ERROR'"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v5h5M20 20v-5h-5"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.49 9A9 9 0 0 0 5.64 5.64L4 7m16 10l-1.64 1.36A9 9 0 0 1 3.51 15"
            />
          </svg>

          <svg
            v-else-if="state === 'NO_PERMISSION'"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8"
            />
          </svg>

          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8"
            />
          </svg>
        </button>

        <button
          type="button"
          aria-label="Ввести текстом"
          class="side-btn"
          @click="switchToKeyboard"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <rect x="2" y="5" width="20" height="14" rx="2.5" />
            <path
              stroke-linecap="round"
              d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8"
            />
          </svg>
        </button>
      </div>

      <button
        v-if="state === 'NO_PERMISSION'"
        type="button"
        class="settings-pill"
        @click="handleMainCircleClick"
      >
        Повторить запрос доступа
      </button>
      <p v-else class="bottom-hint">
        {{ bottomHint }}
      </p>
    </div>

    <div v-else class="compact-bar">
      <form class="compact-form" @submit.prevent="handleTextSubmit">
        <input
          v-model="textInput"
          type="text"
          :disabled="isTextLoading"
          placeholder="Спросите что-нибудь..."
          class="compact-input"
        />
      </form>

      <button
        v-if="textInput.trim()"
        type="button"
        :disabled="isTextLoading"
        aria-label="Отправить текст"
        class="compact-action-btn"
        @click="handleTextSubmit"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5 12h14M12 5l7 7-7 7"
          />
        </svg>
      </button>

      <button
        v-else
        type="button"
        :disabled="isTextLoading"
        aria-label="Голосовой ввод"
        class="compact-action-btn"
        @click="switchToVoiceFromInput"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            d="M19 11a7 7 0 0 1-14 0M12 18v3"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.voice-dock {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 440px;
  z-index: 55;
  padding: 4px 16px 36px;
  background-color: var(--bg-surface);
  border-top: 1px solid #494949;
}

.voice-dock.is-expanded {
  inset: 0;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 72px 16px 28px;
  background-color: var(--bg-app);
  background-image: var(--bg-top-glow);
  background-repeat: no-repeat;
}

.live-speech-overlay {
  margin-bottom: auto;
  padding: 4px 4px 0;
}

.live-speech-text {
  margin: 0;
  font-size: var(--fs-speech);
  font-weight: var(--fw-medium);
  line-height: 1.38;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.expanded-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.wave-track {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 36px;
  margin-bottom: 14px;
}

.wave-dot {
  width: 3px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--text-subtle);
  transition:
    height 0.08s ease,
    background-color 0.15s ease;
}

.wave-dot.is-active {
  background: var(--color-primary);
}

.status-label {
  margin: 0 0 22px;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  line-height: 1.35;
  color: var(--text-primary);
}

.status-label.is-green {
  color: var(--color-primary);
}

.status-label.is-error {
  color: var(--color-danger);
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  min-height: 92px;
}

.side-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: var(--bg-surface-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    background-color 0.15s ease;
}

.side-btn:active {
  transform: scale(0.92);
}

.center-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  border: none;
  border-radius: 50%;
  background: var(--button-primary-bg);
  color: var(--text-inverse);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.center-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.center-btn.state-listening {
  width: 88px;
  height: 88px;
  box-shadow: 0 0 0 10px rgba(46, 213, 52, 0.18);
}

.center-btn.state-processing {
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  cursor: wait;
}

.center-btn.state-error {
  background: var(--color-danger);
  color: var(--text-primary);
  box-shadow: 0 0 0 8px rgba(244, 106, 94, 0.16);
}

.center-btn.state-no_permission {
  background: var(--bg-surface-elevated);
  color: var(--text-subtle);
}

.ring-loader {
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2.5px solid transparent;
  border-top-color: var(--color-primary);
  border-right-color: var(--color-primary);
  animation: spin 1s linear infinite;
}

.bottom-hint {
  margin: 20px 0 4px;
  font-size: var(--fs-caption);
  font-weight: var(--fw-regular);
  color: var(--text-subtle);
}

.settings-pill {
  margin: 18px 0 2px;
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  font-size: var(--fs-sub);
  font-weight: var(--fw-medium);
  cursor: pointer;
}

.compact-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.compact-form {
  flex: 1;
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 16px;
  border-radius: var(--radius-full);
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-default);
}

.compact-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  color: var(--text-primary);
  outline: none;
}

.compact-input::placeholder {
  color: var(--text-muted);
}

.compact-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--button-primary-bg);
  color: #ffffff;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    transform 0.1s ease,
    background-color 0.15s ease;
}

.compact-action-btn:active:not(:disabled) {
  transform: scale(0.93);
}

.compact-action-btn:disabled {
  opacity: 0.5;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
