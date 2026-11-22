<script setup lang="ts">
import type {
  ActiveView,
  AnalyticsPayload,
  AssistantResponse,
  FarmerProductsPayload,
  HistoryItem,
} from '~/types/zoya'
import { ZoyaApiError } from '~/composables/useZoyaApi'

const { fetchHistory, sendTextCommand, resetDemo } = useZoyaApi()

// Состояние пользователя и истории (из GET /api/actions/history)
const userName = ref('Екатерина')
const balance = ref(1800000)
const history = ref<HistoryItem[]>([])
const isHistoryLoading = ref(false)

// Навигация по экранам, боковое меню «Зоя» и развернутый голосовой контроллер
const activeView = ref<ActiveView>('HOME')
const isMenuOpen = ref(false)
const isVoiceMode = ref(false)

// Данные текущего активного сценария
const lastRecognizedText = ref('')
const marketPayload = ref<FarmerProductsPayload | null>(null)
const analyticsPayload = ref<AnalyticsPayload | null>(null)

// Состояние текстового запроса и уведомлений
const isTextLoading = ref(false)
const toastMessage = ref('')

const analyticsInitialStep = ref<'chart' | 'conditions'>('chart')

function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    if (toastMessage.value === msg) {
      toastMessage.value = ''
    }
  }, 3500)
}

/** Загрузка актуального баланса и истории операций */
async function loadHistory() {
  isHistoryLoading.value = true
  try {
    const res = await fetchHistory()
    userName.value = res.user.name
    balance.value = res.balance
    history.value = res.history
  } catch (err) {
    if (err instanceof ZoyaApiError) {
      showToast(err.message)
    }
  } finally {
    isHistoryLoading.value = false
  }
}

const {
  dockState,
  liveTranscript,
  errorMessage,
  volume,
  startRecording,
  stopAndSend,
  cancelRecording,
  resetError,
} = useZoyaVoice({
  onResult: handleAssistantResult,
})

/**
 * Единый обработчик результата ассистента — вызывается и из WebSocket,
 * и из текстового эндпоинта POST /api/assistant/text
 */
function handleAssistantResult(response: AssistantResponse) {
  isVoiceMode.value = false

  if (response.intent === 'farmer-products') {
    lastRecognizedText.value = response.recognizedText
    marketPayload.value = response.payload
    activeView.value = 'MARKET'
    return
  }

  if (response.intent === 'analytics') {
    lastRecognizedText.value = response.recognizedText
    analyticsPayload.value = response.payload
    analyticsInitialStep.value = 'chart'
    activeView.value = 'ANALYTICS'
    loadHistory()
    return
  }

  if (response.intent === 'deposit') {
    lastRecognizedText.value = response.recognizedText
    const { depositOffer, requestedAmount } = response.payload

    analyticsPayload.value = {
      period: 'Вклад',
      totalSpent: 0,
      categories: [],
      aiAdvice: '',
      depositOffer: {
        ...depositOffer,
        defaultAmount: requestedAmount ?? depositOffer.defaultAmount,
      },
    }
    analyticsInitialStep.value = 'conditions'
    activeView.value = 'ANALYTICS'
    return
  }

  // Если intent === 'unknown'
  isVoiceMode.value = true
  dockState.value = 'ERROR'
  errorMessage.value = response.message || 'Не расслышал. Повторите, пожалуйста'
}

/** Отправка текстовой команды (из инпута, с главного экрана или из меню «Зоя») */
async function handleTextCommand(text: string) {
  isMenuOpen.value = false
  if (!text.trim() || isTextLoading.value) {
    return
  }

  resetError()
  isVoiceMode.value = false
  isTextLoading.value = true

  try {
    const res = await sendTextCommand(text)
    handleAssistantResult(res)
  } catch (err) {
    if (err instanceof ZoyaApiError) {
      showToast(err.message)
    } else {
      showToast('Не удалось отправить запрос. Попробуйте ещё раз.')
    }
  } finally {
    isTextLoading.value = false
  }
}

/** Колбэк после успешной оплаты корзины или открытия вклада */
async function handleActionCompleted(newBalance: number) {
  balance.value = newBalance
  await loadHistory()
}

/** Сброс демо-данных перед показом жюри (двойной тап по иконке карандаша или аватарке Зои) */
async function handleResetDemo() {
  try {
    await resetDemo()
    activeView.value = 'HOME'
    marketPayload.value = null
    analyticsPayload.value = null
    isVoiceMode.value = false
    cancelRecording()
    await loadHistory()
    showToast('Демо-счёт и история сброшены')
  } catch (err) {
    if (err instanceof ZoyaApiError) {
      showToast(err.message)
    }
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <main class="app-shell">
    <!-- Всплывающее уведомление -->
    <Transition name="toast">
      <div v-if="toastMessage" class="toast-banner">
        {{ toastMessage }}
      </div>
    </Transition>

    <!-- ЭКРАН 1: ГЛАВНАЯ -->
    <HomeScreen
      v-if="activeView === 'HOME'"
      :user-name="userName"
      :balance="balance"
      @open-menu="isMenuOpen = true"
      @select-prompt="handleTextCommand"
      @reset-demo="handleResetDemo"
    />

    <!-- ЭКРАН 2: СЦЕНАРИЙ ЗАКАЗА ПРОДУКТОВ -->
    <OrderFlow
      v-else-if="activeView === 'MARKET' && marketPayload"
      :recognized-text="lastRecognizedText"
      :payload="marketPayload"
      :account-balance="balance"
      @back="activeView = 'HOME'"
      @open-menu="isMenuOpen = true"
      @select-prompt="handleTextCommand"
      @completed="handleActionCompleted"
    />

    <!-- ЭКРАН 3: СЦЕНАРИЙ АНАЛИТИКИ И ВКЛАДА -->
    <AnalyticsFlow
      v-else-if="activeView === 'ANALYTICS' && analyticsPayload"
      :recognized-text="lastRecognizedText"
      :payload="analyticsPayload"
      :initial-step="analyticsInitialStep"
      @back="activeView = 'HOME'"
      @open-menu="isMenuOpen = true"
      @completed="handleActionCompleted"
    />

    <!-- ВЫЕЗЖАЮЩЕЕ МЕНЮ «ЗОЯ» -->
    <ZoyaDrawer
      :is-open="isMenuOpen"
      :user-name="userName"
      :balance="balance"
      :history="history"
      :is-loading="isHistoryLoading"
      @close="isMenuOpen = false"
      @select-skill="handleTextCommand"
      @reset-demo="handleResetDemo"
    />

    <!-- НИЖНЯЯ ГОЛОСОВАЯ ПАНЕЛЬ (ДОСТУПНА НА ВСЕХ ЭКРАНАХ) -->
    <VoiceDock
      v-model:is-voice-mode="isVoiceMode"
      :state="dockState"
      :live-transcript="liveTranscript"
      :error-message="errorMessage"
      :volume="volume"
      :is-text-loading="isTextLoading"
      @start-voice="
        () => {
          isMenuOpen = false
          startRecording()
        }
      "
      @stop-voice="stopAndSend"
      @cancel-voice="cancelRecording"
      @reset-error="resetError"
      @submit-text="handleTextCommand"
    />
  </main>
</template>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100dvh;
  max-width: 440px;
  margin: 0 auto;
  background: var(--bg-app);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.7);
}

.toast-banner {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  max-width: 380px;
  width: calc(100% - 32px);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  box-shadow: var(--shadow-lg);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
</style>
