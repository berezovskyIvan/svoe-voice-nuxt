<script setup lang="ts">
import type { AnalyticsPayload, CreateDepositResponse } from '~/types/zoya'
import { ZoyaApiError } from '~/composables/useZoyaApi'

const props = defineProps<{
  recognizedText: string
  payload: AnalyticsPayload
  initialStep?: 'chart' | 'conditions'
}>()

const emit = defineEmits<{
  back: []
  openMenu: []
  completed: [newBalance: number]
}>()

const { confirmDeposit } = useZoyaApi()

const offer = computed(() => props.payload.depositOffer)

const step = ref<'chart' | 'conditions' | 'confirm' | 'success'>(
  props.initialStep ?? 'chart',
)

// Интерактивные параметры конструктора (2-й экран макета)
const depositAmount = ref<number>(offer.value.defaultAmount ?? offer.value.minAmount)
const currency = ref<'RUB' | 'CNY'>('RUB')
const selectedTerm = ref<number>(offer.value.termMonths || 6)
const capitalizeInterest = ref(true)
const payoutMode = ref<'monthly' | 'end'>('monthly')
const allowTopUp = ref(false)
const allowWithdraw = ref(false)

// Чекбоксы-тумблеры подписания документов (3-й экран макета)
const agreeService = ref(true)
const agreeContract = ref(true)

const isSubmitting = ref(false)
const submitError = ref('')
const depositResult = ref<CreateDepositResponse | null>(null)
const idempotencyKey = ref<string>('')

watch(
  () => props.payload,
  (next) => {
    depositAmount.value = next.depositOffer.defaultAmount ?? next.depositOffer.minAmount
    selectedTerm.value = next.depositOffer.termMonths || 6
    step.value = props.initialStep ?? 'chart'
    submitError.value = ''
    idempotencyKey.value = ''
  },
)

watch(depositAmount, () => {
  submitError.value = ''
  idempotencyKey.value = ''
})

const termOptions = [
  { label: '3 мес', months: 3 },
  { label: '6 мес', months: 6 },
  { label: '9 мес', months: 9 },
  { label: '1 год', months: 12 },
]

// Расчёт дохода по выбранной сумме и сроку (совпадает с 55 998 ₽ при 800 000 ₽ на 6 мес под 14%)
const previewInterest = computed(() =>
  Math.floor((depositAmount.value * (offer.value.rate / 100) * selectedTerm.value) / 12),
)

const previewTotal = computed(() => depositAmount.value + previewInterest.value)

const chartColors = [
  '#a855f7', // Фиолетовый (Кафе и рестораны)
  '#14b8a6', // Бирюзовый (Развлечения)
  '#facc15', // Жёлтый (Магазины)
  '#f97316', // Оранжевый (Транспорт)
  '#64748b',
]

const donutSegments = computed(() => {
  const circumference = 2 * Math.PI * 38
  let accumulatedPercent = 0

  return props.payload.categories.map((cat, idx) => {
    const dashLength = (cat.percent / 100) * circumference
    const dashOffset = -((accumulatedPercent / 100) * circumference)
    accumulatedPercent += cat.percent

    return {
      ...cat,
      color: chartColors[idx % chartColors.length],
      strokeDasharray: `${Math.max(0, dashLength - 3)} ${circumference}`,
      strokeDashoffset: dashOffset,
    }
  })
})

function formatMoney(val: number): string {
  return new Intl.NumberFormat('ru-RU').format(val)
}

function clampAmount() {
  const min = offer.value.minAmount || 500
  const max = offer.value.maxAmount || 10000000
  const rounded = Math.round(Number(depositAmount.value) || 0)

  if (rounded < min) {
    depositAmount.value = min
  } else if (rounded > max) {
    depositAmount.value = max
  } else {
    depositAmount.value = rounded
  }
}

async function handleOpenDeposit() {
  clampAmount()

  if (!hasEnoughBalance.value) {
    submitError.value = `Недостаточно средств на счёте (доступно ${formatMoney(offer.value.accountBalance)} ₽)`
    return
  }

  if (!agreeService.value || !agreeContract.value || isSubmitting.value) {
    return
  }

  if (!idempotencyKey.value) {
    idempotencyKey.value = crypto.randomUUID()
  }

  isSubmitting.value = true
  submitError.value = ''

  try {
    const res = await confirmDeposit(
      { amount: depositAmount.value },
      idempotencyKey.value,
    )
    depositResult.value = res
    step.value = 'success'
    emit('completed', res.newBalance)
  } catch (err) {
    if (err instanceof ZoyaApiError) {
      submitError.value = err.message
    } else {
      submitError.value = 'Не удалось открыть вклад. Попробуйте ещё раз.'
    }
  } finally {
    isSubmitting.value = false
  }
}

const hasEnoughBalance = computed(() => depositAmount.value <= offer.value.accountBalance)

function goToConfirm() {
  clampAmount()
  if (!hasEnoughBalance.value) {
    submitError.value = `Недостаточно средств на счёте (доступно ${formatMoney(offer.value.accountBalance)} ₽)`
    return
  }
  submitError.value = ''
  step.value = 'confirm'
}
</script>

<template>
  <div class="analytics-flow">
    <div class="top-glow"></div>

    <!-- ВЕРХНЯЯ ПАНЕЛЬ (бургер слева, крестик справа — по 20x20px) -->
    <header class="top-bar">
      <button type="button" aria-label="Меню" class="icon-btn" @click="emit('openMenu')">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
        >
          <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <button
        type="button"
        aria-label="На главную"
        class="icon-btn"
        @click="emit('back')"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <!-- ЭКРАН 1: АНАЛИТИКА ТРАТ + ПРЕДЛОЖЕНИЕ ВКЛАДА (4-й скрин) -->
    <template v-if="step === 'chart'">
      <div v-if="recognizedText" class="user-bubble">
        <div class="bubble-author">Вы</div>
        <div class="bubble-text">{{ recognizedText }}</div>
      </div>

      <div class="zoya-reply">
        <span class="white-status-pill">Финансы проанализированы</span>
        <p class="reply-text">
          В этом месяце вы больше всего потратили на
          {{ payload.categories[0]?.name.toLowerCase() || 'кафе и рестораны' }}.
        </p>

        <div class="spent-total-line">
          Всего потрачено: <strong>{{ formatMoney(payload.totalSpent) }} ₽</strong>
        </div>
      </div>

      <!-- Карточка с бубликом и легендой -->
      <div class="dark-card">
        <div class="donut-center-wrap">
          <div class="donut-box">
            <svg viewBox="0 0 100 100" class="donut-svg">
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                stroke-width="11"
              />
              <circle
                v-for="seg in donutSegments"
                :key="seg.code"
                cx="50"
                cy="50"
                r="38"
                fill="none"
                :stroke="seg.color"
                stroke-width="11"
                stroke-linecap="round"
                :stroke-dasharray="seg.strokeDasharray"
                :stroke-dashoffset="seg.strokeDashoffset"
              />
            </svg>
          </div>
        </div>

        <ul class="legend-list">
          <li v-for="(cat, idx) in payload.categories" :key="cat.code" class="legend-row">
            <span
              class="legend-dot"
              :style="{ backgroundColor: chartColors[idx % chartColors.length] }"
            ></span>
            <span class="legend-name">{{ cat.name }}</span>
            <span class="legend-percent">{{ cat.percent }}%</span>
            <span class="legend-val">{{ formatMoney(cat.amount) }} ₽</span>
          </li>
        </ul>
      </div>

      <!-- Инсайт по тратам -->
      <div class="dark-card insight-card">
        <div class="insight-badge">🕒</div>
        <div class="insight-body">
          <div class="insight-title">На кафе −18% к прошлому месяцу</div>
          <div class="insight-sub">Установить лимит 12 000 ₽ в месяц?</div>
          <span class="green-link">Установить лимит</span>
        </div>
      </div>

      <!-- Совет ИИ -->
      <p v-if="payload.aiAdvice" class="advice-paragraph">
        {{ payload.aiAdvice }}
      </p>

      <!-- Карточка параметров вклада -->
      <div class="dark-card params-card">
        <div class="param-item">
          <div class="param-label">Срок вклада</div>
          <div class="param-val">{{ selectedTerm }} мес</div>
        </div>
        <div class="param-item">
          <div class="param-label">Выплата процентов</div>
          <div class="param-val">Ежемесячно</div>
        </div>
        <div class="param-item">
          <div class="param-label">Сумма на вкладе</div>
          <div class="param-val">{{ formatMoney(depositAmount) }} ₽</div>
        </div>
        <div class="param-item">
          <div class="param-label">Условия</div>
          <div class="param-val">Без пополнения, без частичного снятия</div>
        </div>
      </div>

      <!-- Плашка 14% с доходом -->
      <div class="dark-card rate-summary-card">
        <div class="rate-big">{{ offer.rate }} %</div>
        <div class="rate-income-col">
          <div class="rate-plus">+ {{ formatMoney(previewInterest) }} ₽</div>
          <div class="rate-total">Итого {{ formatMoney(previewTotal) }} ₽</div>
        </div>
        <div class="safe-emoji">🔐</div>
      </div>

      <button type="button" class="primary-cta-btn" @click="step = 'conditions'">
        К открытию вклада
      </button>
    </template>
    <!-- ЭКРАН 2: ПРОВЕРЬТЕ УСЛОВИЯ ОТКРЫТИЯ ВКЛАДА (3-й скрин, старт для intent=deposit) -->
    <template v-else-if="step === 'conditions'">
      <p class="screen-lead">
        Проверьте условия открытия вклада или установите собственные.
      </p>

      <!-- Карточка ввода суммы с зелёным подчёркиванием -->
      <div class="dark-card amount-card">
        <div class="amount-input-row">
          <input
            v-model.number="depositAmount"
            type="number"
            :min="offer.minAmount"
            :max="offer.maxAmount"
            class="amount-field"
            @blur="clampAmount"
          />
          <span class="currency-sign">{{ currency === 'RUB' ? '₽' : '¥' }}</span>
        </div>
        <div class="amount-bounds">
          От {{ formatMoney(offer.minAmount) }} ₽ до {{ formatMoney(offer.maxAmount) }} ₽
        </div>

        <div class="currency-pills">
          <button
            type="button"
            class="pill-choice"
            :class="{ 'is-active': currency === 'RUB' }"
            @click="currency = 'RUB'"
          >
            Рубль ₽
          </button>
          <button
            type="button"
            class="pill-choice"
            :class="{ 'is-active': currency === 'CNY' }"
            @click="currency = 'CNY'"
          >
            Юань ¥
          </button>
        </div>
      </div>

      <h2 class="section-title">Условия вклада</h2>
      <div class="dark-card conditions-card">
        <!-- Сроки -->
        <div class="terms-row">
          <button
            v-for="t in termOptions"
            :key="t.months"
            type="button"
            class="pill-choice"
            :class="{ 'is-active': selectedTerm === t.months }"
            @click="selectedTerm = t.months"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- Тумблер 1 -->
        <label class="toggle-row">
          <span class="toggle-label">Оставлять проценты на вкладе</span>
          <input v-model="capitalizeInterest" type="checkbox" class="ios-switch" />
        </label>

        <!-- Выплата процентов -->
        <div class="sub-label">Выплата процентов</div>
        <div class="payout-pills">
          <button
            type="button"
            class="pill-choice"
            :class="{ 'is-active': payoutMode === 'monthly' }"
            @click="payoutMode = 'monthly'"
          >
            Ежемесячно
          </button>
          <button
            type="button"
            class="pill-choice"
            :class="{ 'is-active': payoutMode === 'end' }"
            @click="payoutMode = 'end'"
          >
            В конце срока
          </button>
        </div>

        <!-- Тумблер 2 -->
        <label class="toggle-row">
          <span class="toggle-label">С пополнением</span>
          <input v-model="allowTopUp" type="checkbox" class="ios-switch" />
        </label>

        <!-- Тумблер 3 -->
        <label class="toggle-row">
          <span class="toggle-label">С частичным снятием</span>
          <input v-model="allowWithdraw" type="checkbox" class="ios-switch" />
        </label>
      </div>

      <!-- Плашка 14% с доходом -->
      <div class="dark-card rate-summary-card">
        <div class="rate-big">{{ offer.rate }} %</div>
        <div class="rate-income-col">
          <div class="rate-plus">+ {{ formatMoney(previewInterest) }} ₽</div>
          <div class="rate-total">Итого {{ formatMoney(previewTotal) }} ₽</div>
        </div>
        <div class="safe-emoji">🔐</div>
      </div>

      <div v-if="submitError" class="notice-error">
        {{ submitError }}
      </div>

      <button type="button" class="primary-cta-btn" @click="goToConfirm">
        Продолжить
      </button>
    </template>

    <!-- ЭКРАН 3: ВЫБЕРИТЕ СЧЁТ И ПОДПИШИТЕ ДОКУМЕНТЫ (2-й скрин) -->
    <template v-else-if="step === 'confirm'">
      <p class="screen-lead">
        Осталось еще немного. Выберите счёт и подпишите документы:
      </p>

      <!-- Жёлто-лаймовая карточка вклада -->
      <div class="yellow-deposit-card">
        <div class="yellow-top">
          <span class="yellow-amount">{{ formatMoney(depositAmount) }} ₽</span>
          <span class="yellow-plus-badge">+ {{ formatMoney(previewInterest) }} ₽</span>
        </div>

        <div class="yellow-bottom">
          <div>
            <div class="yellow-val">{{ selectedTerm }} месяцев</div>
            <div class="yellow-label">Срок вклада</div>
          </div>
          <div>
            <div class="yellow-val">{{ offer.rate }}%</div>
            <div class="yellow-label">Ставка</div>
          </div>
          <div class="coins-emoji">🪙</div>
        </div>
      </div>

      <!-- Блок с фиолетовой картой и согласиями -->
      <div class="dark-card sign-card">
        <div class="purple-account-card">
          <div class="purple-balance">{{ formatMoney(offer.accountBalance) }} ₽</div>
          <div class="purple-label">Накопительный счёт **6785</div>
        </div>

        <div class="passport-line">
          Паспорт продукта <span class="green-inline">Вклад Доходный</span>
        </div>

        <label class="toggle-row is-agreement">
          <span class="agreement-text">
            Соглашаюсь на
            <span class="green-inline">оказание услуг по открытию вклада</span>
          </span>
          <input v-model="agreeService" type="checkbox" class="ios-switch" />
        </label>

        <label class="toggle-row is-agreement">
          <span class="agreement-text">
            Соглашаюсь с условиями
            <span class="green-inline">Договора банковского вклада</span>
          </span>
          <input v-model="agreeContract" type="checkbox" class="ios-switch" />
        </label>
      </div>

      <div class="dual-actions">
        <button
          type="button"
          :disabled="isSubmitting"
          class="secondary-btn"
          @click="step = 'conditions'"
        >
          Назад
        </button>
        <button
          type="button"
          :disabled="isSubmitting || !agreeService || !agreeContract || !hasEnoughBalance"
          class="primary-cta-btn no-margin"
          @click="handleOpenDeposit"
        >
          {{ isSubmitting ? 'Открываю...' : 'Открыть' }}
        </button>
      </div>
    </template>

    <!-- ЭКРАН 4: ВКЛАД ОТКРЫТ (1-й скрин) -->
    <template v-else-if="step === 'success' && depositResult">
      <div class="success-screen">
        <div class="stacked-check-badge">✓</div>
        <div class="success-green-label">Вклад открыт</div>
        <div class="success-big-amount">{{ formatMoney(depositResult.amount) }} ₽</div>
        <div class="success-rate-sub">Ставка {{ depositResult.rate }}% годовых</div>

        <div class="next-actions-wrap">
          <div class="next-actions-header">
            <span class="sparkle">✦</span>
            <span>Могу помочь с:</span>
          </div>

          <div class="dark-card actions-trio">
            <button type="button" class="trio-item" @click="emit('back')">
              <span class="trio-circle">🔔</span>
              <span class="trio-label">Настроить уведомления</span>
            </button>
            <button type="button" class="trio-item" @click="emit('back')">
              <span class="trio-circle">⇄</span>
              <span class="trio-label">Настроить автопополнение</span>
            </button>
            <button type="button" class="trio-item" @click="emit('openMenu')">
              <span class="trio-circle is-green">i</span>
              <span class="trio-label">Детали операции</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.analytics-flow {
  position: relative;
  min-height: 100dvh;
  padding: 16px 16px 104px;
  overflow: hidden;
}

.top-glow {
  position: absolute;
  inset: 0;
  background: var(--bg-glow-compact);
  pointer-events: none;
  z-index: 0;
}

.top-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.user-bubble {
  position: relative;
  z-index: 1;
  margin-left: auto;
  margin-bottom: 14px;
  max-width: 82%;
  padding: 10px 14px;
  border-radius: 18px 18px 4px 18px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-default);
}

.bubble-author {
  font-size: var(--fs-micro);
  font-weight: var(--fw-medium);
  color: var(--color-primary);
  margin-bottom: 3px;
}

.bubble-text {
  font-size: var(--fs-body);
  line-height: 1.38;
  color: var(--text-primary);
}

.zoya-reply {
  position: relative;
  z-index: 1;
  margin-bottom: 14px;
}

.white-status-pill {
  display: inline-block;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  background: #ffffff;
  color: #080a08;
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
}

.reply-text {
  margin: 10px 0 6px;
  font-size: var(--fs-body-lg);
  line-height: 1.4;
  color: var(--text-primary);
}

.spent-total-line {
  font-size: var(--fs-body);
  color: var(--text-muted);
}

.spent-total-line strong {
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
}

.dark-card {
  position: relative;
  z-index: 1;
  padding: 16px;
  border-radius: 24px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
}

.donut-center-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}

.donut-box {
  width: 132px;
  height: 132px;
}

.donut-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sub);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}

.legend-percent {
  color: var(--text-muted);
}

.legend-val {
  margin-left: auto;
  color: var(--text-muted);
}

.insight-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 10px;
}

.insight-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(251, 191, 36, 0.16);
  font-size: 16px;
  flex-shrink: 0;
}

.insight-title {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.insight-sub {
  margin-top: 2px;
  font-size: var(--fs-caption);
  color: var(--text-muted);
}

.green-link {
  display: inline-block;
  margin-top: 4px;
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
  color: var(--color-primary);
}

.advice-paragraph {
  position: relative;
  z-index: 1;
  margin: 14px 0;
  font-size: var(--fs-body);
  line-height: 1.45;
  color: var(--text-primary);
}

.params-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.param-label {
  font-size: var(--fs-caption);
  color: var(--text-muted);
}

.param-val {
  margin-top: 2px;
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.rate-summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
}

.rate-big {
  font-size: 24px;
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
  white-space: nowrap;
}

.rate-income-col {
  flex: 1;
}

.rate-plus {
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
}

.rate-total {
  margin-top: 2px;
  font-size: var(--fs-caption);
  color: var(--text-muted);
}

.safe-emoji {
  font-size: 28px;
}

.screen-lead {
  position: relative;
  z-index: 1;
  margin: 0 0 14px;
  font-size: var(--fs-body-lg);
  line-height: 1.4;
  color: var(--text-primary);
}

.amount-input-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-primary);
}

.amount-field {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 24px;
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
  outline: none;
}

.currency-sign {
  font-size: 20px;
  color: var(--text-muted);
}

.amount-bounds {
  margin-top: 8px;
  font-size: var(--fs-caption);
  color: var(--text-muted);
}

.currency-pills,
.terms-row,
.payout-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.terms-row {
  margin-top: 0;
}

.pill-choice {
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  cursor: pointer;
}

.pill-choice.is-active {
  background: #ffffff;
  color: #080a08;
}

.section-title {
  position: relative;
  z-index: 1;
  margin: 18px 0 10px;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.conditions-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sub-label {
  font-size: var(--fs-caption);
  color: var(--text-muted);
  margin-bottom: -8px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.toggle-label {
  font-size: var(--fs-body);
  color: var(--text-primary);
}

/* Нативные iOS-переключатели из макета */
.ios-switch {
  appearance: none;
  position: relative;
  width: 46px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--bg-surface-elevated);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

.ios-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.2s ease;
}

.ios-switch:checked {
  background: var(--color-primary);
}

.ios-switch:checked::after {
  transform: translateX(20px);
}

/* Жёлто-лаймовая карточка вклада (2-й скрин) */
.yellow-deposit-card {
  position: relative;
  z-index: 1;
  padding: 18px;
  border-radius: 24px;
  background: var(--card-deposit-yellow);
  color: #091205;
}

.yellow-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.yellow-amount {
  font-size: 26px;
  font-weight: var(--fw-semibold);
  letter-spacing: -0.02em;
}

.yellow-plus-badge {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: #ffffff;
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
}

.yellow-bottom {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  margin-top: 20px;
}

.yellow-val {
  font-size: var(--fs-body);
  font-weight: var(--fw-semibold);
}

.yellow-label {
  margin-top: 2px;
  font-size: var(--fs-micro);
  opacity: 0.72;
}

.coins-emoji {
  margin-left: auto;
  font-size: 32px;
}

/* Карточка списания и согласий (2-й скрин) */
.sign-card {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.purple-account-card {
  padding: 16px 18px;
  border-radius: 18px;
  background: var(--card-account-purple);
  color: #ffffff;
}

.purple-balance {
  font-size: 20px;
  font-weight: var(--fw-semibold);
}

.purple-label {
  margin-top: 4px;
  font-size: var(--fs-caption);
  opacity: 0.85;
}

.passport-line {
  font-size: var(--fs-sub);
  color: var(--text-primary);
}

.green-inline {
  color: var(--color-primary);
}

.agreement-text {
  font-size: var(--fs-sub);
  line-height: 1.35;
  color: var(--text-primary);
}

.notice-error {
  position: relative;
  z-index: 1;
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--fs-caption);
}

.dual-actions {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}

.primary-cta-btn {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 48px;
  margin-top: 16px;
  padding: 0 20px;
  border: none;
  border-radius: 16px;
  background: var(--color-primary);
  color: #ffffff;
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    background-color 0.15s ease;
}

.primary-cta-btn.no-margin {
  margin-top: 0;
}

.primary-cta-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.primary-cta-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  height: 48px;
  padding: 0 20px;
  border: none;
  border-radius: 16px;
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-medium);
  cursor: pointer;
}

/* Экран 4: Вклад открыт (1-й скрин) */
.success-screen {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 32px;
}

.stacked-check-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  border-radius: 22px;
  background: linear-gradient(
    135deg,
    var(--color-primary-light) 0%,
    var(--color-primary) 100%
  );
  color: #ffffff;
  font-size: 40px;
  font-weight: var(--fw-semibold);
}

.success-green-label {
  margin-top: 22px;
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-medium);
  color: var(--color-primary);
}

.success-big-amount {
  margin-top: 4px;
  font-size: 28px;
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
}

.success-rate-sub {
  margin-top: 6px;
  font-size: var(--fs-sub);
  color: var(--text-muted);
}

.next-actions-wrap {
  width: 100%;
  margin-top: 40px;
  text-align: left;
}

.next-actions-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.sparkle {
  color: var(--color-primary);
}

.actions-trio {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 16px 10px;
}

.trio-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  text-align: center;
  cursor: pointer;
}

.trio-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-surface-elevated);
  font-size: 16px;
}

.trio-circle.is-green {
  background: var(--color-primary);
  color: #ffffff;
  font-weight: var(--fw-semibold);
}

.trio-label {
  font-size: var(--fs-caption);
  line-height: 1.25;
  color: var(--text-secondary);
}
</style>
