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
    const h = Math.max(4, Math.min(56, Math.round(props.volume * w * 68)))
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
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
          >
            <path
              d="M21.6566 8.45728C22.1773 7.93659 23.0217 7.93662 23.5424 8.45728C24.0631 8.97797 24.0631 9.82232 23.5424 10.343L17.8851 16.0002L23.5424 21.6575C24.0631 22.1782 24.0631 23.0225 23.5424 23.5432C23.0216 24.0638 22.1773 24.0639 21.6566 23.5432L15.9994 17.886L10.3431 23.5422C9.82243 24.0628 8.97806 24.0629 8.4574 23.5422C7.93677 23.0216 7.93682 22.1772 8.4574 21.6565L14.1136 16.0002L8.4574 10.344C7.93674 9.82334 7.93683 8.97896 8.4574 8.45825C8.9781 7.93755 9.82244 7.93755 10.3431 8.45825L15.9994 14.1145L21.6566 8.45728Z"
              fill="#FCFCFD"
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
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="white"
          >
            <rect x="6" y="5" width="4" height="14" rx="1.5" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" />
          </svg>

          <svg
            v-else-if="state === 'ERROR'"
            xmlns="http://www.w3.org/2000/svg"
            width="42"
            height="47"
            viewBox="0 0 42 47"
            fill="none"
          >
            <path
              d="M2.33301 21C3.62167 21 4.66602 22.0443 4.66602 23.333C4.66602 32.3537 11.9793 39.666 21 39.666C25.4487 39.666 29.482 37.8886 32.4297 35H25.667C24.3783 35 23.333 33.9547 23.333 32.666C23.3332 31.3775 24.3784 30.333 25.667 30.333H37.333C37.9518 30.333 38.5458 30.579 38.9834 31.0166C39.4208 31.4541 39.6669 32.0474 39.667 32.666V44.333C39.667 45.6217 38.6217 46.666 37.333 46.666C36.0445 46.6658 35 45.6216 35 44.333V38.9814C31.2861 42.306 26.3804 44.3329 21 44.333C9.40202 44.333 2.83495e-06 34.931 0 23.333C0 22.0444 1.04438 21 2.33301 21ZM4.66699 0C5.95551 0.000176734 7 1.04445 7 2.33301V7.68359C10.7139 4.35927 15.6198 2.33301 21 2.33301C32.598 2.33301 42 11.735 42 23.333C42 24.6216 40.9555 25.6658 39.667 25.666C38.3783 25.666 37.333 24.6217 37.333 23.333C37.333 14.3124 30.0207 7 21 7C16.5512 7 12.5181 8.77741 9.57031 11.666H16.333C17.6217 11.666 18.667 12.7113 18.667 14C18.6668 15.2885 17.6216 16.333 16.333 16.333H4.66699C4.04815 16.333 3.45419 16.087 3.0166 15.6494C2.57919 15.2119 2.33309 14.6186 2.33301 14V2.33301C2.33301 1.04434 3.37833 5.63293e-08 4.66699 0Z"
              fill="white"
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

          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="38"
            height="47"
            viewBox="0 0 38 47"
            fill="none"
          >
            <path
              d="M1.75488 17.8779C2.7207 17.8804 3.50227 18.667 3.5 19.6328C3.49075 23.6644 5.05128 27.4631 7.89746 30.3213C10.7418 33.1796 14.5276 34.7575 18.5596 34.7715H18.5664L18.5781 34.7744C26.8939 34.7486 33.6513 27.9579 33.6328 19.6328C33.6305 18.6646 34.4121 17.8804 35.3779 17.8779H35.3828C36.3487 17.8779 37.1303 18.6572 37.1328 19.623C37.1561 29.2923 29.757 37.2753 20.3164 38.1807V42.875H26.9678C27.9337 42.8757 28.7178 43.6589 28.7178 44.625C28.7176 45.5909 27.9336 46.3743 26.9678 46.375H10.167C9.20075 46.3748 8.41717 45.5912 8.41699 44.625C8.41699 43.6586 9.20064 42.8752 10.167 42.875H16.8164V38.1826C12.5046 37.772 8.51056 35.8974 5.41895 32.792C1.9121 29.2687 -0.011638 24.5906 0 19.623C0.0025079 18.6572 0.786489 17.878 1.75 17.8779H1.75488ZM18.5664 0C23.9185 0.000604952 28.2713 4.35429 28.2715 9.7041V19.5576C28.2806 24.9145 23.93 29.2843 18.5732 29.2988C15.9647 29.2942 13.523 28.2773 11.6914 26.4365C9.85984 24.5955 8.85433 22.1516 8.86133 19.5547V9.7041C8.8615 4.35392 13.2161 0 18.5664 0Z"
              fill="white"
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
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21.6553 5.33301C22.7285 5.33299 23.6144 5.33363 24.3359 5.39258C25.0853 5.45381 25.7739 5.5854 26.4209 5.91504C27.4244 6.42632 28.2406 7.2417 28.752 8.24512C29.0817 8.89223 29.2132 9.58159 29.2744 10.3311C29.3334 11.0526 29.333 11.9385 29.333 13.0117V18.9883C29.333 20.0615 29.3334 20.9474 29.2744 21.6689C29.2132 22.4184 29.0817 23.1078 28.752 23.7549C28.2406 24.7583 27.4243 25.5737 26.4209 26.085C25.7739 26.4146 25.0853 26.5462 24.3359 26.6074C23.6144 26.6664 22.7285 26.667 21.6553 26.667H10.3447C9.27153 26.667 8.38561 26.6664 7.66406 26.6074C6.91473 26.5462 6.22612 26.4146 5.5791 26.085C4.57565 25.5737 3.75938 24.7583 3.24805 23.7549C2.91833 23.1078 2.78682 22.4184 2.72559 21.6689C2.66664 20.9474 2.66698 20.0615 2.66699 18.9883V13.0117C2.66698 11.9385 2.66664 11.0526 2.72559 10.3311C2.78682 9.58159 2.91833 8.89223 3.24805 8.24512C3.75938 7.2417 4.57565 6.42632 5.5791 5.91504C6.22612 5.5854 6.91473 5.45381 7.66406 5.39258C8.38561 5.33363 9.27153 5.33299 10.3447 5.33301H21.6553ZM10.4004 8C9.25858 8 8.48189 8.00081 7.88184 8.0498C7.29728 8.09756 6.9976 8.18476 6.78906 8.29102C6.28747 8.54669 5.87962 8.95442 5.62402 9.45605C5.51779 9.66456 5.43155 9.96345 5.38379 10.5479C5.33476 11.1479 5.33301 11.9244 5.33301 13.0664V18.9336C5.33301 20.0756 5.33476 20.8521 5.38379 21.4521C5.43155 22.0365 5.51779 22.3354 5.62402 22.5439C5.87962 23.0456 6.28747 23.4533 6.78906 23.709C6.9976 23.8152 7.29728 23.9024 7.88184 23.9502C8.48189 23.9992 9.25858 24 10.4004 24H21.5996C22.7414 24 23.5181 23.9992 24.1182 23.9502C24.7027 23.9024 25.0024 23.8152 25.2109 23.709C25.7125 23.4533 26.1204 23.0456 26.376 22.5439C26.4822 22.3354 26.5684 22.0365 26.6162 21.4521C26.6652 20.8521 26.667 20.0756 26.667 18.9336V13.0664C26.667 11.9244 26.6652 11.1479 26.6162 10.5479C26.5684 9.96346 26.4822 9.66456 26.376 9.45605C26.1204 8.95442 25.7125 8.54669 25.2109 8.29102C25.0024 8.18476 24.7027 8.09756 24.1182 8.0498C23.5181 8.00081 22.7414 8 21.5996 8H10.4004ZM9.33301 17.333C10.0694 17.333 10.667 17.9306 10.667 18.667C10.6668 19.4032 10.0693 20 9.33301 20C8.59689 19.9998 8.00018 19.4031 8 18.667C8 17.9307 8.59678 17.3332 9.33301 17.333ZM17.333 17.333C18.0694 17.333 18.667 17.9306 18.667 18.667C18.6668 19.4032 18.0693 20 17.333 20H14.667C13.9307 20 13.3332 19.4032 13.333 18.667C13.333 17.9306 13.9306 17.333 14.667 17.333H17.333ZM22.667 17.333C23.4032 17.3332 24 17.9307 24 18.667C23.9998 19.4031 23.4031 19.9998 22.667 20C21.9307 20 21.3332 19.4032 21.333 18.667C21.333 17.9306 21.9306 17.333 22.667 17.333ZM9.33301 12C10.0693 12 10.6668 12.5968 10.667 13.333C10.667 14.0694 10.0694 14.667 9.33301 14.667C8.59678 14.6668 8 14.0693 8 13.333C8.00017 12.5969 8.59689 12.0002 9.33301 12ZM14.667 12C15.4031 12.0002 15.9998 12.5969 16 13.333C16 14.0693 15.4032 14.6668 14.667 14.667C13.9306 14.667 13.333 14.0694 13.333 13.333C13.3332 12.5968 13.9307 12 14.667 12ZM22.667 12C23.4031 12.0002 23.9998 12.5969 24 13.333C24 14.0693 23.4032 14.6668 22.667 14.667H20C19.2636 14.667 18.667 14.0694 18.667 13.333C18.6672 12.5968 19.2637 12 20 12H22.667Z"
              fill="#FCFCFD"
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
  height: 58px;
  margin-bottom: 16px;
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
  min-height: 156px;
}

.side-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
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
  width: 112px;
  height: 112px;
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
  width: 150px;
  height: 150px;
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
