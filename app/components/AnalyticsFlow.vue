<script setup lang="ts">
import type { AnalyticsPayload, CreateDepositResponse } from '@/types/zoya'
import { ZoyaApiError } from '@/composables/useZoyaApi'

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

const depositAmount = ref<number>(offer.value.defaultAmount ?? offer.value.minAmount)
const currency = ref<'RUB' | 'CNY'>('RUB')
const selectedTerm = ref<number>(offer.value.termMonths || 6)
const capitalizeInterest = ref(true)
const payoutMode = ref<'monthly' | 'end'>('monthly')
const allowTopUp = ref(false)
const allowWithdraw = ref(false)

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

const previewInterest = computed(() =>
  Math.floor((depositAmount.value * (offer.value.rate / 100) * selectedTerm.value) / 12),
)

const previewTotal = computed(() => depositAmount.value + previewInterest.value)

const chartColors = ['#D500F9', '#03BFA5', '#FF3D00', '#FFC403', '#64748b']

const donutSegments = computed(() => {
  const cx = 110
  const cy = 110
  const r = 64
  const circumference = 2 * Math.PI * r

  const items = props.payload.categories
  const totalAmount =
    items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) ||
    Number(props.payload.totalSpent) ||
    1

  let accumulatedPercent = 0

  return items.map((cat, idx) => {
    const amount = Number(cat.amount) || 0
    const exactPercent = (amount / totalAmount) * 100
    const displayPercent = Math.round(exactPercent)

    const startPercent = accumulatedPercent
    const endPercent = accumulatedPercent + exactPercent
    const midPercent = startPercent + exactPercent / 2

    const midAngle = ((midPercent / 100) * 360 - 90) * (Math.PI / 180)
    const labelRadius = r + 32
    const labelX = cx + labelRadius * Math.cos(midAngle)
    const labelY = cy + labelRadius * Math.sin(midAngle)

    const startArc = (startPercent / 100) * circumference
    const fullArc = (exactPercent / 100) * circumference
    const endArc = startArc + fullArc

    const iconAngle = ((endArc / circumference) * 360 - 90) * (Math.PI / 180)
    const iconX = cx + r * Math.cos(iconAngle)
    const iconY = cy + r * Math.sin(iconAngle)

    accumulatedPercent = endPercent

    return {
      ...cat,
      idx,
      displayPercent,
      circumference,
      startArc,
      endArc,
      color: chartColors[idx % chartColors.length],
      strokeDasharray: `${Math.max(0.1, fullArc)} ${circumference}`,
      strokeDashoffset: -startArc,
      labelX,
      labelY,
      iconX,
      iconY,
    }
  })
})

const reversedSegments = computed(() => [...donutSegments.value].reverse())
const lastSegment = computed(() => donutSegments.value[donutSegments.value.length - 1])

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

const formattedDepositAmount = computed(() =>
  depositAmount.value > 0 ? formatMoney(depositAmount.value) : '',
)

function handleAmountInput(event: Event) {
  const input = event.target as HTMLInputElement
  const rawValue = input.value
  const selectionStart = input.selectionStart ?? rawValue.length
  const digitsBeforeCursor = rawValue.slice(0, selectionStart).replace(/\D/g, '').length

  const digitsOnly = rawValue.replace(/\D/g, '')
  const numericValue = digitsOnly ? Number(digitsOnly) : 0

  depositAmount.value = numericValue
  const formatted = numericValue > 0 ? formatMoney(numericValue) : ''
  input.value = formatted

  let newCursorPos = 0
  let countedDigits = 0
  while (newCursorPos < formatted.length && countedDigits < digitsBeforeCursor) {
    if (/\d/.test(formatted[newCursorPos]!)) {
      countedDigits++
    }
    newCursorPos++
  }
  input.setSelectionRange(newCursorPos, newCursorPos)
}
</script>

<template>
  <div class="analytics-flow">
    <div class="top-glow"></div>

    <header class="top-bar">
      <button type="button" aria-label="Меню" class="icon-btn" @click="emit('openMenu')">
        <svg
          width="20"
          height="20"
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

      <div class="dark-card">
        <div class="donut-center-wrap">
          <div class="donut-box">
            <svg viewBox="0 0 220 220" class="donut-svg">
              <defs>
                <filter id="donut-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <mask
                  v-for="seg in donutSegments"
                  :id="`seg-cutout-${seg.idx}`"
                  :key="`mask-${seg.code}`"
                  maskUnits="userSpaceOnUse"
                >
                  <rect x="0" y="0" width="220" height="220" fill="#FFFFFF" />
                  <circle
                    v-if="donutSegments.length > 1"
                    cx="110"
                    cy="110"
                    r="64"
                    fill="none"
                    stroke="#000000"
                    stroke-width="21"
                    stroke-linecap="round"
                    :stroke-dasharray="`0.1 ${seg.circumference}`"
                    :stroke-dashoffset="-seg.startArc"
                  />
                </mask>
              </defs>

              <circle
                cx="110"
                cy="110"
                r="64"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                stroke-width="18"
              />

              <g transform="rotate(-90 110 110)" filter="url(#donut-glow)">
                <circle
                  v-for="seg in reversedSegments"
                  :key="seg.code"
                  cx="110"
                  cy="110"
                  r="64"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="18"
                  stroke-linecap="round"
                  :mask="`url(#seg-cutout-${seg.idx})`"
                  :stroke-dasharray="seg.strokeDasharray"
                  :stroke-dashoffset="seg.strokeDashoffset"
                />

                <circle
                  v-if="donutSegments.length > 1 && lastSegment"
                  cx="110"
                  cy="110"
                  r="64"
                  fill="none"
                  :stroke="lastSegment.color"
                  stroke-width="18"
                  stroke-linecap="round"
                  :stroke-dasharray="`0.1 ${lastSegment.circumference}`"
                  :stroke-dashoffset="-lastSegment.endArc"
                />
              </g>
              <g
                v-for="seg in donutSegments"
                :key="`icon-${seg.code}`"
                :transform="`translate(${seg.iconX - 6}, ${seg.iconY - 6})`"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path
                    v-if="seg.idx === 0"
                    d="M13.6123 7.40353C13.7337 7.40354 13.8272 7.51083 13.8105 7.63107L12.9932 13.5246C12.9157 14.084 12.4371 14.5012 11.8721 14.5012H10.5234C10.3897 14.5012 10.3265 14.3068 10.4199 14.2112C10.7679 13.8566 10.9823 13.3702 10.9824 12.8342V11.0403C10.9824 9.67778 10.3545 8.46281 9.37207 7.66818C9.26901 7.58484 9.32549 7.4038 9.45801 7.40353H13.6123ZM6.32031 7.4006C8.27143 7.40074 9.87602 8.87893 10.0771 10.7766C10.0892 10.8903 9.99807 10.9864 9.88379 10.9865H5.76562C5.48949 10.9865 5.26562 11.2104 5.26562 11.4865C5.26575 11.7626 5.48956 11.9865 5.76562 11.9865H9.89844C10.0088 11.9865 10.0986 12.0763 10.0986 12.1867V12.6047C10.0986 13.6514 9.24986 14.5002 8.20312 14.5002H3.78223C2.73547 14.5002 1.88672 13.6514 1.88672 12.6047V12.1867C1.88672 12.0763 1.97646 11.9865 2.08691 11.9865H3.63867C3.91474 11.9865 4.13855 11.7626 4.13867 11.4865C4.13867 11.2104 3.91481 10.9865 3.63867 10.9865H2.10156C1.98733 10.9863 1.89618 10.8902 1.9082 10.7766C2.1094 8.87889 3.71462 7.40078 5.66504 7.4006H6.32031ZM10.6436 1.47971C10.8388 1.28467 11.1554 1.28452 11.3506 1.47971C11.5456 1.67489 11.5456 1.9915 11.3506 2.18674L10.8291 2.70724C10.6524 2.88403 10.5538 3.12371 10.5537 3.37424V4.17404C10.554 4.21065 10.5835 4.24045 10.6201 4.24045H12.9824C13.6683 4.24067 14.197 4.8471 14.1025 5.52756L14.0059 6.23068C13.9921 6.32939 13.9073 6.40238 13.8076 6.40256H6.86621C6.76548 6.40256 6.67966 6.3277 6.66699 6.22775L6.57812 5.52365C6.48589 4.84481 7.01394 4.24054 7.69922 4.24045H9.48633C9.52297 4.24045 9.55346 4.21065 9.55371 4.17404V3.37424C9.55383 2.8585 9.75777 2.36453 10.1221 2.00021L10.6436 1.47971Z"
                    fill="#FFFFFF"
                  />
                  <path
                    v-else-if="seg.idx === 1"
                    d="M5.53613 1.86621C7.62247 1.86628 9.31836 3.56208 9.31836 5.64844C9.31824 7.36346 8.1153 9.2512 6.40039 9.74414L6.73242 10.083C6.86682 10.2238 6.9059 10.4292 6.8291 10.6084C6.75229 10.7876 6.5787 10.9023 6.38672 10.9023H6.00977C5.93299 10.9279 5.79874 10.9987 5.75391 11.1074C5.69631 11.229 5.73485 11.4214 5.85645 11.6582C6.48327 12.8995 6.04135 13.7636 5.81738 14.0771C5.72777 14.205 5.58028 14.2822 5.42676 14.2822C5.33103 14.2821 5.23534 14.2498 5.15234 14.1924C4.93477 14.0388 4.88357 13.7381 5.03711 13.5205C5.18431 13.3093 5.38205 12.8416 4.99805 12.0928C4.77418 11.6577 4.72336 11.2543 4.81934 10.9023H4.69141C4.49952 10.9023 4.32687 10.7874 4.25 10.6084C4.1732 10.4292 4.2113 10.2238 4.3457 10.083L4.67871 9.74414C2.9636 9.25777 1.75989 7.36358 1.75977 5.64844C1.75977 3.56204 3.45613 1.86621 5.53613 1.86621ZM10.752 3.70215C12.6783 3.70215 14.2401 5.26409 14.2402 7.19043C14.2402 8.75203 13.1583 10.4737 11.5967 10.9473L11.9229 11.2803C12.0573 11.4147 12.0963 11.626 12.0195 11.7988C11.9427 11.978 11.7691 12.0928 11.5771 12.0928H11.4814C11.4942 12.1246 11.5072 12.1503 11.5137 12.1758C11.5777 12.4189 11.5905 12.7969 11.3027 13.2256C11.1427 13.4624 11.1357 13.578 11.1357 13.5908C11.1996 13.8468 11.046 14.1089 10.79 14.1729C10.7518 14.1792 10.7072 14.1855 10.6689 14.1855C10.4578 14.1855 10.2588 14.0388 10.2012 13.8213C10.118 13.4885 10.2145 13.1172 10.5088 12.6885C10.6112 12.5349 10.5923 12.4509 10.5859 12.4189C10.5538 12.2911 10.4124 12.1695 10.3037 12.0928H9.93262C9.74076 12.0927 9.56803 11.9779 9.49121 11.7988C9.41445 11.6261 9.45266 11.4147 9.58691 11.2803L9.91406 10.9473C9.2228 10.7345 8.59082 10.2766 8.11523 9.64355C8.05015 9.55682 8.0765 9.43454 8.16504 9.37207C9.35133 8.53839 10.1181 7.03763 10.1182 5.64844C10.1182 5.08523 10.0021 4.55079 9.79004 4.07129C9.7414 3.96138 9.79616 3.8305 9.91309 3.80273C10.1847 3.73825 10.4663 3.70215 10.752 3.70215ZM11.0273 5.30859C10.7649 5.30859 10.5469 5.52026 10.5469 5.78906C10.5469 6.05143 10.765 6.26855 11.0273 6.26855C11.4369 6.26863 11.7695 6.60217 11.7695 7.01172C11.7697 7.27397 11.9877 7.49121 12.25 7.49121C12.5185 7.49099 12.7293 7.27384 12.7295 7.01172C12.7295 6.07095 11.9681 5.30867 11.0273 5.30859ZM5.13281 3.58691C4.04484 3.58691 3.15532 4.47693 3.15527 5.57129C3.15527 5.83355 3.36617 6.05152 3.63477 6.05176C3.89717 6.05176 4.11523 5.83369 4.11523 5.57129C4.11528 5.00813 4.56964 4.54785 5.13281 4.54785C5.4016 4.54784 5.61328 4.32978 5.61328 4.06738C5.61328 3.80499 5.40161 3.58692 5.13281 3.58691Z"
                    fill="#FFFFFF"
                  />
                  <path
                    v-else-if="seg.idx === 2"
                    d="M5.20398 2.93481C7.06665 2.64081 8.95207 2.64215 10.8114 2.93481C11.1618 2.99153 11.4907 3.14155 11.7626 3.36938C12.0344 3.59661 12.2406 3.89362 12.3573 4.22876L13.0565 6.16724V6.16821C13.3445 6.13355 13.6328 6.10211 13.9208 6.06079C14.1914 6.02212 14.4469 6.21324 14.4862 6.48657C14.5248 6.75991 14.3347 7.01334 14.0614 7.052C13.8182 7.08598 13.5739 7.11217 13.33 7.14282L13.6454 7.56567C13.9886 8.03497 14.1708 8.58865 14.1708 9.16724V12.3723C14.1807 12.4782 14.1645 12.602 14.1239 12.7151C14.0846 12.8284 14.0208 12.9321 13.9354 13.0208C13.8495 13.11 13.7495 13.1773 13.6376 13.2219C13.5517 13.2569 13.4638 13.2773 13.3739 13.2825H12.0477C12.0357 13.2831 12.0236 13.2834 12.0116 13.2834C11.9103 13.2834 11.8014 13.2626 11.7001 13.2219C11.5901 13.1773 11.4891 13.1094 11.4032 13.0208C11.3188 12.9315 11.2553 12.8292 11.2147 12.7141C11.1742 12.5996 11.1588 12.4762 11.1688 12.3577L11.1678 12.2239C11.1692 12.1773 11.161 12.1327 11.1444 12.0901C11.1277 12.0494 11.1025 12.0117 11.0712 11.9797C11.0392 11.9471 11.0018 11.9225 10.9598 11.9045C10.9199 11.8886 10.8745 11.8792 10.83 11.8792H5.1825C5.13783 11.8792 5.0923 11.8889 5.05164 11.9055C5.01035 11.9228 4.97325 11.9471 4.94128 11.9797C4.91 12.0117 4.88535 12.0494 4.86804 12.092C4.85205 12.1327 4.84296 12.1782 4.84363 12.2229V12.3723C4.85354 12.4755 4.8386 12.5993 4.79871 12.7131C4.75738 12.8305 4.69324 12.9334 4.60925 13.0208C4.52525 13.1081 4.4214 13.1779 4.3114 13.2219C4.22697 13.2559 4.13843 13.2771 4.04773 13.2825H2.71472C2.59617 13.2871 2.48092 13.2653 2.36902 13.22C2.25719 13.1734 2.15603 13.1033 2.0741 13.0168C1.99082 12.9289 1.92758 12.8261 1.88757 12.7122C1.84763 12.5976 1.83207 12.4782 1.84265 12.3577L1.85535 9.17896C1.85473 8.60785 2.03096 8.06074 2.36609 7.59888L2.69519 7.14478C2.44321 7.11344 2.19033 7.08733 1.93835 7.052C1.66505 7.01334 1.47493 6.7599 1.51355 6.48657C1.55288 6.21259 1.80367 6.02549 2.07898 6.06079C2.37431 6.10279 2.67067 6.13581 2.96667 6.17114C2.96803 6.16788 2.97025 6.16466 2.97156 6.16138L3.6698 4.22485C3.78443 3.89495 3.98976 3.59829 4.25964 3.37231C4.52824 3.14504 4.85475 2.99285 5.20398 2.93481ZM4.44324 8.8479C4.16743 8.84812 3.94324 9.07204 3.94324 9.3479C3.94326 9.62375 4.16744 9.84768 4.44324 9.8479H5.64246C5.91838 9.84782 6.14244 9.62384 6.14246 9.3479C6.14246 9.07195 5.91839 8.84798 5.64246 8.8479H4.44324ZM10.3641 8.8479C10.0882 8.848 9.86414 9.07196 9.86414 9.3479C9.86416 9.62382 10.0882 9.8478 10.3641 9.8479H11.5624C11.8383 9.84787 12.0624 9.62386 12.0624 9.3479C12.0624 9.07192 11.8384 8.84793 11.5624 8.8479H10.3641ZM10.6532 3.92212C8.89869 3.64553 7.11931 3.64548 5.36414 3.92212C5.19684 3.95013 5.03584 4.02499 4.9032 4.13696C4.76949 4.24954 4.66914 4.39444 4.61121 4.55884L3.99109 6.28247C6.6663 6.53845 9.35818 6.53782 12.0341 6.28052L11.4149 4.56372C11.3556 4.39388 11.2551 4.24793 11.1219 4.13599C10.9873 4.02399 10.8252 3.94945 10.6532 3.92212Z"
                    fill="#FFFFFF"
                  />
                  <path
                    v-else
                    d="M8.2963 2.06738C8.83 2.06738 9.32075 2.31111 9.64395 2.73535L12.0609 5.91602H12.1068C12.9542 5.91602 13.5813 6.16342 13.9691 6.65234C14.3889 7.18094 14.4853 7.94276 14.2582 8.91797L13.64 11.8896C13.3814 13.2987 12.3377 13.9326 11.4193 13.9326H5.17618C4.25718 13.9326 3.21342 13.2987 2.95352 11.8818L2.33438 8.91113C2.10919 7.94296 2.20722 7.1803 2.62637 6.65234C3.01486 6.16347 3.64204 5.91602 4.48868 5.91602H4.53165L6.94962 2.73535C7.27216 2.31118 7.7633 2.06741 8.2963 2.06738ZM6.86172 8.37207C6.59677 8.37207 6.38126 8.58758 6.38126 8.85254C6.38129 9.11747 6.59678 9.33203 6.86172 9.33203H9.83145C10.0962 9.33185 10.3109 9.11736 10.3109 8.85254C10.3109 8.58769 10.0963 8.37225 9.83145 8.37207H6.86172ZM8.8793 3.31641C8.60023 2.94915 7.9923 2.94909 7.71329 3.31641L5.7377 5.91602H10.8549L8.8793 3.31641Z"
                    fill="#FFFFFF"
                  />
                </svg>
              </g>

              <text
                v-for="seg in donutSegments"
                :key="`label-${seg.code}`"
                :x="seg.labelX"
                :y="seg.labelY"
                text-anchor="middle"
                dominant-baseline="central"
                class="donut-percent-label"
              >
                {{ seg.displayPercent }}%
              </text>
            </svg>
          </div>
        </div>

        <ul class="legend-list">
          <li v-for="(cat, idx) in payload.categories" :key="cat.code" class="legend-row">
            <span class="legend-icon-box">
              <!-- Иконка: Кафе и рестораны (0) -->
              <svg
                v-if="idx === 0"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13.6123 7.40353C13.7337 7.40354 13.8272 7.51083 13.8105 7.63107L12.9932 13.5246C12.9157 14.084 12.4371 14.5012 11.8721 14.5012H10.5234C10.3897 14.5012 10.3265 14.3068 10.4199 14.2112C10.7679 13.8566 10.9823 13.3702 10.9824 12.8342V11.0403C10.9824 9.67778 10.3545 8.46281 9.37207 7.66818C9.26901 7.58484 9.32549 7.4038 9.45801 7.40353H13.6123ZM6.32031 7.4006C8.27143 7.40074 9.87602 8.87893 10.0771 10.7766C10.0892 10.8903 9.99807 10.9864 9.88379 10.9865H5.76562C5.48949 10.9865 5.26562 11.2104 5.26562 11.4865C5.26575 11.7626 5.48956 11.9865 5.76562 11.9865H9.89844C10.0088 11.9865 10.0986 12.0763 10.0986 12.1867V12.6047C10.0986 13.6514 9.24986 14.5002 8.20312 14.5002H3.78223C2.73547 14.5002 1.88672 13.6514 1.88672 12.6047V12.1867C1.88672 12.0763 1.97646 11.9865 2.08691 11.9865H3.63867C3.91474 11.9865 4.13855 11.7626 4.13867 11.4865C4.13867 11.2104 3.91481 10.9865 3.63867 10.9865H2.10156C1.98733 10.9863 1.89618 10.8902 1.9082 10.7766C2.1094 8.87889 3.71462 7.40078 5.66504 7.4006H6.32031ZM10.6436 1.47971C10.8388 1.28467 11.1554 1.28452 11.3506 1.47971C11.5456 1.67489 11.5456 1.9915 11.3506 2.18674L10.8291 2.70724C10.6524 2.88403 10.5538 3.12371 10.5537 3.37424V4.17404C10.554 4.21065 10.5835 4.24045 10.6201 4.24045H12.9824C13.6683 4.24067 14.197 4.8471 14.1025 5.52756L14.0059 6.23068C13.9921 6.32939 13.9073 6.40238 13.8076 6.40256H6.86621C6.76548 6.40256 6.67966 6.3277 6.66699 6.22775L6.57812 5.52365C6.48589 4.84481 7.01394 4.24054 7.69922 4.24045H9.48633C9.52297 4.24045 9.55346 4.21065 9.55371 4.17404V3.37424C9.55383 2.8585 9.75777 2.36453 10.1221 2.00021L10.6436 1.47971Z"
                  fill="#D500F9"
                />
              </svg>

              <!-- Иконка: Развлечения (1) -->

              <svg
                v-else-if="idx === 1"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.53613 1.86621C7.62247 1.86628 9.31836 3.56208 9.31836 5.64844C9.31824 7.36346 8.1153 9.2512 6.40039 9.74414L6.73242 10.083C6.86682 10.2238 6.9059 10.4292 6.8291 10.6084C6.75229 10.7876 6.5787 10.9023 6.38672 10.9023H6.00977C5.93299 10.9279 5.79874 10.9987 5.75391 11.1074C5.69631 11.229 5.73485 11.4214 5.85645 11.6582C6.48327 12.8995 6.04135 13.7636 5.81738 14.0771C5.72777 14.205 5.58028 14.2822 5.42676 14.2822C5.33103 14.2821 5.23534 14.2498 5.15234 14.1924C4.93477 14.0388 4.88357 13.7381 5.03711 13.5205C5.18431 13.3093 5.38205 12.8416 4.99805 12.0928C4.77418 11.6577 4.72336 11.2543 4.81934 10.9023H4.69141C4.49952 10.9023 4.32687 10.7874 4.25 10.6084C4.1732 10.4292 4.2113 10.2238 4.3457 10.083L4.67871 9.74414C2.9636 9.25777 1.75989 7.36358 1.75977 5.64844C1.75977 3.56204 3.45613 1.86621 5.53613 1.86621ZM10.752 3.70215C12.6783 3.70215 14.2401 5.26409 14.2402 7.19043C14.2402 8.75203 13.1583 10.4737 11.5967 10.9473L11.9229 11.2803C12.0573 11.4147 12.0963 11.626 12.0195 11.7988C11.9427 11.978 11.7691 12.0928 11.5771 12.0928H11.4814C11.4942 12.1246 11.5072 12.1503 11.5137 12.1758C11.5777 12.4189 11.5905 12.7969 11.3027 13.2256C11.1427 13.4624 11.1357 13.578 11.1357 13.5908C11.1996 13.8468 11.046 14.1089 10.79 14.1729C10.7518 14.1792 10.7072 14.1855 10.6689 14.1855C10.4578 14.1855 10.2588 14.0388 10.2012 13.8213C10.118 13.4885 10.2145 13.1172 10.5088 12.6885C10.6112 12.5349 10.5923 12.4509 10.5859 12.4189C10.5538 12.2911 10.4124 12.1695 10.3037 12.0928H9.93262C9.74076 12.0927 9.56803 11.9779 9.49121 11.7988C9.41445 11.6261 9.45266 11.4147 9.58691 11.2803L9.91406 10.9473C9.2228 10.7345 8.59082 10.2766 8.11523 9.64355C8.05015 9.55682 8.0765 9.43454 8.16504 9.37207C9.35133 8.53839 10.1181 7.03763 10.1182 5.64844C10.1182 5.08523 10.0021 4.55079 9.79004 4.07129C9.7414 3.96138 9.79616 3.8305 9.91309 3.80273C10.1847 3.73825 10.4663 3.70215 10.752 3.70215ZM11.0273 5.30859C10.7649 5.30859 10.5469 5.52026 10.5469 5.78906C10.5469 6.05143 10.765 6.26855 11.0273 6.26855C11.4369 6.26863 11.7695 6.60217 11.7695 7.01172C11.7697 7.27397 11.9877 7.49121 12.25 7.49121C12.5185 7.49099 12.7293 7.27384 12.7295 7.01172C12.7295 6.07095 11.9681 5.30867 11.0273 5.30859ZM5.13281 3.58691C4.04484 3.58691 3.15532 4.47693 3.15527 5.57129C3.15527 5.83355 3.36617 6.05152 3.63477 6.05176C3.89717 6.05176 4.11523 5.83369 4.11523 5.57129C4.11528 5.00813 4.56964 4.54785 5.13281 4.54785C5.4016 4.54784 5.61328 4.32978 5.61328 4.06738C5.61328 3.80499 5.40161 3.58692 5.13281 3.58691Z"
                  fill="#03BFA5"
                />
              </svg>

              <!-- Иконка: Магазины (2) -->
              <svg
                v-else-if="idx === 2"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.20398 2.93481C7.06665 2.64081 8.95207 2.64215 10.8114 2.93481C11.1618 2.99153 11.4907 3.14155 11.7626 3.36938C12.0344 3.59661 12.2406 3.89362 12.3573 4.22876L13.0565 6.16724V6.16821C13.3445 6.13355 13.6328 6.10211 13.9208 6.06079C14.1914 6.02212 14.4469 6.21324 14.4862 6.48657C14.5248 6.75991 14.3347 7.01334 14.0614 7.052C13.8182 7.08598 13.5739 7.11217 13.33 7.14282L13.6454 7.56567C13.9886 8.03497 14.1708 8.58865 14.1708 9.16724V12.3723C14.1807 12.4782 14.1645 12.602 14.1239 12.7151C14.0846 12.8284 14.0208 12.9321 13.9354 13.0208C13.8495 13.11 13.7495 13.1773 13.6376 13.2219C13.5517 13.2569 13.4638 13.2773 13.3739 13.2825H12.0477C12.0357 13.2831 12.0236 13.2834 12.0116 13.2834C11.9103 13.2834 11.8014 13.2626 11.7001 13.2219C11.5901 13.1773 11.4891 13.1094 11.4032 13.0208C11.3188 12.9315 11.2553 12.8292 11.2147 12.7141C11.1742 12.5996 11.1588 12.4762 11.1688 12.3577L11.1678 12.2239C11.1692 12.1773 11.161 12.1327 11.1444 12.0901C11.1277 12.0494 11.1025 12.0117 11.0712 11.9797C11.0392 11.9471 11.0018 11.9225 10.9598 11.9045C10.9199 11.8886 10.8745 11.8792 10.83 11.8792H5.1825C5.13783 11.8792 5.0923 11.8889 5.05164 11.9055C5.01035 11.9228 4.97325 11.9471 4.94128 11.9797C4.91 12.0117 4.88535 12.0494 4.86804 12.092C4.85205 12.1327 4.84296 12.1782 4.84363 12.2229V12.3723C4.85354 12.4755 4.8386 12.5993 4.79871 12.7131C4.75738 12.8305 4.69324 12.9334 4.60925 13.0208C4.52525 13.1081 4.4214 13.1779 4.3114 13.2219C4.22697 13.2559 4.13843 13.2771 4.04773 13.2825H2.71472C2.59617 13.2871 2.48092 13.2653 2.36902 13.22C2.25719 13.1734 2.15603 13.1033 2.0741 13.0168C1.99082 12.9289 1.92758 12.8261 1.88757 12.7122C1.84763 12.5976 1.83207 12.4782 1.84265 12.3577L1.85535 9.17896C1.85473 8.60785 2.03096 8.06074 2.36609 7.59888L2.69519 7.14478C2.44321 7.11344 2.19033 7.08733 1.93835 7.052C1.66505 7.01334 1.47493 6.7599 1.51355 6.48657C1.55288 6.21259 1.80367 6.02549 2.07898 6.06079C2.37431 6.10279 2.67067 6.13581 2.96667 6.17114C2.96803 6.16788 2.97025 6.16466 2.97156 6.16138L3.6698 4.22485C3.78443 3.89495 3.98976 3.59829 4.25964 3.37231C4.52824 3.14504 4.85475 2.99285 5.20398 2.93481ZM4.44324 8.8479C4.16743 8.84812 3.94324 9.07204 3.94324 9.3479C3.94326 9.62375 4.16744 9.84768 4.44324 9.8479H5.64246C5.91838 9.84782 6.14244 9.62384 6.14246 9.3479C6.14246 9.07195 5.91839 8.84798 5.64246 8.8479H4.44324ZM10.3641 8.8479C10.0882 8.848 9.86414 9.07196 9.86414 9.3479C9.86416 9.62382 10.0882 9.8478 10.3641 9.8479H11.5624C11.8383 9.84787 12.0624 9.62386 12.0624 9.3479C12.0624 9.07192 11.8384 8.84793 11.5624 8.8479H10.3641ZM10.6532 3.92212C8.89869 3.64553 7.11931 3.64548 5.36414 3.92212C5.19684 3.95013 5.03584 4.02499 4.9032 4.13696C4.76949 4.24954 4.66914 4.39444 4.61121 4.55884L3.99109 6.28247C6.6663 6.53845 9.35818 6.53782 12.0341 6.28052L11.4149 4.56372C11.3556 4.39388 11.2551 4.24793 11.1219 4.13599C10.9873 4.02399 10.8252 3.94945 10.6532 3.92212Z"
                  fill="#FF3D00"
                />
              </svg>

              <svg
                v-else
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8.2963 2.06738C8.83 2.06738 9.32075 2.31111 9.64395 2.73535L12.0609 5.91602H12.1068C12.9542 5.91602 13.5813 6.16342 13.9691 6.65234C14.3889 7.18094 14.4853 7.94276 14.2582 8.91797L13.64 11.8896C13.3814 13.2987 12.3377 13.9326 11.4193 13.9326H5.17618C4.25718 13.9326 3.21342 13.2987 2.95352 11.8818L2.33438 8.91113C2.10919 7.94296 2.20722 7.1803 2.62637 6.65234C3.01486 6.16347 3.64204 5.91602 4.48868 5.91602H4.53165L6.94962 2.73535C7.27216 2.31118 7.7633 2.06741 8.2963 2.06738ZM6.86172 8.37207C6.59677 8.37207 6.38126 8.58758 6.38126 8.85254C6.38129 9.11747 6.59678 9.33203 6.86172 9.33203H9.83145C10.0962 9.33185 10.3109 9.11736 10.3109 8.85254C10.3109 8.58769 10.0963 8.37225 9.83145 8.37207H6.86172ZM8.8793 3.31641C8.60023 2.94915 7.9923 2.94909 7.71329 3.31641L5.7377 5.91602H10.8549L8.8793 3.31641Z"
                  fill="#FFC403"
                />
              </svg>
            </span>

            <span class="legend-name">{{ cat.name }}</span>
            <span class="legend-val">{{ formatMoney(cat.amount) }} ₽</span>
          </li>
        </ul>
      </div>

      <div class="dark-card insight-card">
        <img class="insight-badge" src="/images/clock.webp" alt="Часы" />
        <div class="insight-body">
          <div class="insight-title">На кафе −18% к прошлому месяцу</div>
          <div class="insight-sub">Установить лимит 12 000 ₽ в месяц?</div>
          <span class="green-link">Установить лимит</span>
        </div>
      </div>

      <p v-if="payload.aiAdvice" class="advice-paragraph">
        {{ payload.aiAdvice }}
      </p>

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
      </div>

      <button type="button" class="primary-cta-btn" @click="step = 'conditions'">
        К открытию вклада
      </button>
    </template>

    <template v-else-if="step === 'conditions'">
      <p class="screen-lead">
        Проверьте условия открытия вклада или установите собственные.
      </p>

      <div class="dark-card amount-card">
        <div
          class="amount-input-row"
          @click="($refs.amountInputRef as HTMLInputElement)?.focus()"
        >
          <div class="amount-sizer-wrap">
            <span class="amount-mirror" aria-hidden="true">{{
              formattedDepositAmount || '0'
            }}</span>
            <input
              ref="amountInputRef"
              :value="formattedDepositAmount"
              type="text"
              inputmode="numeric"
              class="amount-field"
              @input="handleAmountInput"
              @blur="clampAmount"
            />
          </div>
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

        <label class="toggle-row">
          <span class="toggle-label">Оставлять проценты на вкладе</span>
          <input v-model="capitalizeInterest" type="checkbox" class="ios-switch" />
        </label>

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

        <label class="toggle-row">
          <span class="toggle-label">С частичным снятием</span>
          <input v-model="allowWithdraw" type="checkbox" class="ios-switch" />
        </label>
      </div>

      <div class="dark-card rate-summary-card">
        <div class="rate-big">{{ offer.rate }} %</div>
        <div class="rate-income-col">
          <div class="rate-plus">+ {{ formatMoney(previewInterest) }} ₽</div>
          <div class="rate-total">Итого {{ formatMoney(previewTotal) }} ₽</div>
        </div>
      </div>

      <div v-if="submitError" class="notice-error">
        {{ submitError }}
      </div>

      <button type="button" class="primary-cta-btn" @click="goToConfirm">
        Продолжить
      </button>
    </template>

    <template v-else-if="step === 'confirm'">
      <p class="screen-lead">
        Осталось еще немного. Выберите счёт и подпишите документы:
      </p>

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
          <img class="coins-emoji" src="/images/money-sack.webp" alt="Мешок денег" />
        </div>
      </div>

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

    <template v-else-if="step === 'success' && depositResult">
      <div class="success-screen">
        <img
          class="contribution-illustration"
          src="/images/contribution.webp"
          alt="Вклад"
        />
        <div class="success-green-label">Вклад открыт</div>
        <div class="success-big-amount">{{ formatMoney(depositResult.amount) }} ₽</div>
        <div class="success-rate-sub">Ставка {{ depositResult.rate }}% годовых</div>

        <div class="next-actions-wrap">
          <div class="next-actions-header">
            <svg
              class="sparkle"
              width="19"
              height="19"
              viewBox="0 0 19 19"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7.875 2.66406C8.30685 2.66406 8.67257 2.92911 8.80469 3.33887L10.3408 8.07129L15.0742 9.6084C15.477 9.73644 15.7509 10.1102 15.751 10.5391C15.751 10.967 15.4772 11.3417 15.0713 11.4707L10.3301 13.0098L8.80469 17.7383C8.67267 18.1482 8.30697 18.4141 7.875 18.4141C7.44203 18.4141 7.07736 18.1482 6.94434 17.7383L5.40625 12.998L0.676758 11.4697C0.27281 11.3417 0 10.967 0 10.5391C9.79679e-05 10.1103 0.272949 9.73649 0.678711 9.60742L5.4209 8.06836L6.94434 3.33887C7.07745 2.92912 7.44215 2.66406 7.875 2.66406ZM15.1611 0.308594C15.2945 -0.10283 15.9791 -0.102916 16.1123 0.308594C16.5013 1.50959 17.4513 2.45766 18.6543 2.84766C18.8602 2.9147 19 3.10727 19 3.32422C18.9999 3.54004 18.8601 3.73174 18.6543 3.79883C17.4534 4.18778 16.5034 5.14087 16.1123 6.34766C16.0463 6.55366 15.8527 6.69434 15.6357 6.69434C15.4198 6.69423 15.2271 6.55357 15.1611 6.34766C14.7701 5.14083 13.82 4.18781 12.6191 3.79883C12.4132 3.73184 12.2735 3.54016 12.2734 3.32422C12.2734 3.10722 12.4131 2.91466 12.6191 2.84766C13.822 2.45761 14.7722 1.50951 15.1611 0.308594Z"
                fill="#60FF60"
              />
            </svg>
            <span>Могу помочь с:</span>
          </div>

          <div class="dark-card actions-trio">
            <button type="button" class="trio-item" @click="emit('back')">
              <div class="trio-circle">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M14.4607 19.0909C14.7487 19.0909 15.0115 19.2567 15.1365 19.5167C15.2613 19.7766 15.2266 20.0847 15.0466 20.3097C14.3776 21.1464 13.3895 21.6261 12.3357 21.6261C11.2898 21.626 10.3055 21.1465 9.6355 20.3106C9.4556 20.0858 9.41992 19.7766 9.54468 19.5167C9.66963 19.2578 9.93255 19.091 10.2205 19.0909H14.4607ZM6.79761 7.13388C7.31982 4.33304 10.3698 1.79836 14.0876 2.49033C15.8125 2.81237 17.2908 3.77436 18.2488 5.20029C19.1237 6.50425 19.4775 8.05145 19.2175 9.44638C18.9316 10.9842 19.1859 11.7049 19.4548 12.4679C19.7158 13.2098 19.9851 13.9761 19.7312 15.337C19.1742 17.3779 17.7126 18.1035 15.4119 18.1036C14.2449 18.1036 12.8613 17.9172 11.2703 17.6212C6.54647 16.7412 3.8733 15.6192 4.19214 12.4864C4.45112 11.0865 4.97808 10.4681 5.48804 9.87021C6.01404 9.25521 6.51161 8.67288 6.79761 7.13388Z"
                    fill="#55D440"
                  />
                </svg>
              </div>
              <span class="trio-label">Настроить уведомления</span>
            </button>
            <button type="button" class="trio-item" @click="emit('back')">
              <div class="trio-circle">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M18.3857 10.7996C18.9163 10.7998 19.3455 11.23 19.3457 11.7596V13.574C19.3457 14.8806 18.8365 16.1115 17.9111 17.0389C16.9838 17.9643 15.7538 18.4744 14.4453 18.4744H7.93359L9.17969 19.7205C9.55505 20.0949 9.55505 20.7026 9.17969 21.0779C8.99251 21.265 8.74665 21.3592 8.50098 21.3592C8.25528 21.3591 8.00942 21.2651 7.82227 21.0779L4.93945 18.1961C4.85017 18.1068 4.77845 17.9997 4.72949 17.8817C4.69696 17.8041 4.69021 17.7189 4.67969 17.6356C4.67394 17.5944 4.65437 17.5576 4.6543 17.5145V17.5125C4.6543 17.3848 4.68149 17.2586 4.72949 17.1424C4.76598 17.0571 4.82431 16.9858 4.88184 16.9149C4.90282 16.889 4.91271 16.8568 4.93652 16.8338L7.82324 13.9568C8.19956 13.5824 8.80626 13.5834 9.18066 13.9588C9.55495 14.3342 9.55403 14.9419 9.17871 15.3172L7.93652 16.5545H14.4453C15.2412 16.5545 15.9892 16.244 16.5527 15.6805C17.1152 15.1179 17.4258 14.3689 17.4258 13.574V11.7596C17.426 11.2298 17.855 10.7996 18.3857 10.7996ZM14.8291 2.44122C15.2035 2.06615 15.8113 2.06597 16.1865 2.44122L19.0576 5.31329C19.1497 5.40349 19.2226 5.51178 19.2715 5.63361C19.2983 5.69785 19.302 5.76767 19.3135 5.83575C19.323 5.88936 19.3456 5.93947 19.3457 5.99591C19.3457 6.03431 19.328 6.06785 19.3232 6.10529C19.3137 6.1925 19.305 6.2797 19.2715 6.36212C19.2226 6.48006 19.1526 6.58639 19.0635 6.6756L16.1865 9.55353C15.9984 9.74068 15.7535 9.83471 15.5078 9.83478C15.2622 9.83478 15.0163 9.74057 14.8291 9.55353C14.4538 9.17914 14.4538 8.57147 14.8291 8.19611L16.0684 6.95685H9.55469C8.75789 6.95685 8.00984 7.26636 7.44824 7.82892C6.8924 8.3838 6.5752 9.15197 6.5752 9.93634V11.7596C6.57505 12.2894 6.14505 12.7195 5.61426 12.7195C5.08369 12.7193 4.65444 12.2892 4.6543 11.7596V9.93634C4.6543 8.64701 5.17785 7.3835 6.08984 6.4715C7.01432 5.54606 8.24525 5.03595 9.55469 5.03595H16.0664L14.8291 3.79865C14.4538 3.42328 14.4537 2.81658 14.8291 2.44122Z"
                    fill="#55D440"
                  />
                </svg>
              </div>
              <span class="trio-label">Настроить автопополнение</span>
            </button>
            <button type="button" class="trio-item" @click="emit('openMenu')">
              <div class="trio-circle">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 2C17.5232 2 22 6.47679 22 12C22 17.5221 17.5233 22 12 22C6.47672 22 2 17.5221 2 12C2 6.4768 6.4768 2 12 2ZM12.0059 10.3936C11.4536 10.3936 11.0059 10.8413 11.0059 11.3936V15.6934C11.0059 16.2456 11.4536 16.6934 12.0059 16.6934C12.558 16.6933 13.0058 16.2455 13.0059 15.6934V11.3936C13.0058 10.8413 12.5581 10.3936 12.0059 10.3936ZM12 7.29102C11.4477 7.29102 11 7.73873 11 8.29102V8.35449C11.0001 8.90667 11.4478 9.35449 12 9.35449C12.5522 9.35449 12.9999 8.90667 13 8.35449V8.29102C13 7.73873 12.5523 7.29102 12 7.29102Z"
                    fill="#55D440"
                  />
                </svg>
              </div>
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
  margin-bottom: 16px;
  max-width: 65%;
  padding: 8px;
  border-radius: 16px 16px 16px 0;
  background: var(--bg-surface-elevated);
}

.bubble-author {
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
  color: var(--color-primary);
  margin-bottom: 2px;
}

.bubble-text {
  font-size: var(--fs-sub);
  line-height: 1.38;
  color: var(--text-primary);
}

.zoya-reply {
  position: relative;
  z-index: 1;
  margin-bottom: 16px;
}

.white-status-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  width: fit-content;
  padding: 0 8px;
  border-radius: var(--radius-full);
  background: #ffffff;
  color: #080a08;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  margin-bottom: 16px;
}

.reply-text {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: var(--fs-sub);
  line-height: 1.4;
  color: var(--text-primary);
}

.spent-total-line {
  font-size: var(--fs-sub);
  color: var(--text-muted);
}

.spent-total-line strong {
  font-weight: var(--fw-regular);
  color: var(--text-primary);
}

.dark-card {
  position: relative;
  z-index: 1;
  padding: 16px;
  border-radius: 24px;
  background: var(--bg-surface);
}

.donut-center-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}

.donut-box {
  width: 220px;
  height: 220px;
}

.donut-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.donut-percent-label {
  fill: var(--text-muted);
  font-size: 14px;
  font-weight: var(--fw-regular);
  font-variant-numeric: tabular-nums;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 10px;
  color: #ffffff;
  flex-shrink: 0;
}

.legend-name {
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.legend-val {
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
  color: var(--text-muted);
}

.insight-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding: 10px 16px;
}

.insight-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(251, 191, 36, 0.16);
  font-size: 16px;
  flex-shrink: 0;
}

.insight-title {
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
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
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  color: var(--color-primary);
}

.advice-paragraph {
  position: relative;
  z-index: 1;
  margin: 16px 0;
  font-size: var(--fs-sub);
  line-height: 1.45;
  color: var(--text-primary);
}

.params-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-label {
  font-size: var(--fs-body);
  color: var(--text-muted);
}

.param-val {
  margin-top: 2px;
  font-size: var(--fs-sub);
  font-weight: var(--fw-regular);
  color: var(--text-primary);
}

.rate-summary-card {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  border-radius: var(--radius-md);
  background-image: url('/images/safe.webp');
  background-size: cover;
  background-repeat: no-repeat;
}

.rate-big {
  font-size: 20px;
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  border-right: 1px solid #525252;
  padding-right: 8px;
  height: 41px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rate-income-col {
  flex: 1;
}

.rate-plus {
  font-size: 20px;
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.rate-total {
  margin-top: 2px;
  font-size: var(--fs-caption);
  color: var(--text-muted);
}

.screen-lead {
  position: relative;
  z-index: 1;
  margin: 0 0 16px;
  font-size: var(--fs-sub);
  line-height: 1.4;
  color: var(--text-primary);
}

.amount-input-row {
  display: flex;
  align-items: baseline;
  justify-content: flex-start;
  gap: 4px;
  padding: 12px 8px;
  border-bottom: 2px solid var(--color-primary);
  cursor: text;

  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
}

.amount-sizer-wrap {
  position: relative;
  display: inline-block;
  max-width: calc(100% - 24px);
}

.amount-sizer-wrap {
  display: inline-grid;
  align-items: baseline;
  max-width: calc(100% - 24px);
}

.amount-mirror {
  display: inline-block;
  visibility: hidden;
  white-space: pre;
  font-family: inherit;
  font-size: 24px;
  font-weight: var(--fw-semibold);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.amount-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 24px;
  font-weight: var(--fw-semibold);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: var(--text-primary);
  outline: none;
}

.currency-sign {
  font-size: 24px;
  font-weight: var(--fw-semibold);
  color: var(--text-muted);
  user-select: none;
  pointer-events: none;
  flex-shrink: 0;
}

.amount-field::-webkit-outer-spin-button,
.amount-field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.amount-card {
  border-radius: 32px;
}

.amount-bounds {
  margin-top: 8px;
  padding-bottom: 8px;
  font-size: var(--fs-body);
  color: var(--text-muted);
}

.currency-pills,
.terms-row,
.payout-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 0;
}

.terms-row {
  margin-top: 0;
}

.pill-choice {
  min-height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  font-size: var(--fs-sub);
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
  margin: 16px 0 12px;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.conditions-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sub-label {
  font-size: var(--fs-body);
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
  font-size: var(--fs-sub);
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
  background: var(--button-primary-bg);
}

.ios-switch:checked::after {
  transform: translateX(20px);
}

/* Жёлто-лаймовая карточка вклада (2-й скрин) */
.yellow-deposit-card {
  overflow: hidden;
  position: relative;
  z-index: 1;
  padding: 16px;
  border-radius: 24px;
  background: linear-gradient(41deg, #98e916 0%, #cde916 55.93%, #fff 122.93%), #fff;
  color: #091205;
}

.dark-card.sign-card {
  gap: 24px;
}

.yellow-top {
  display: flex;
  align-items: center;
  gap: 32px;
}

.yellow-amount {
  font-size: 26px;
  font-weight: var(--fw-semibold);
  letter-spacing: -0.02em;
}

.yellow-plus-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-full);
  background: #55d440;
  color: #ffffff;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
}

.yellow-bottom {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  margin-top: 16px;
}

.yellow-val {
  font-size: var(--fs-speech);
  font-weight: var(--fw-medium);
}

.yellow-label {
  margin-top: 2px;
  font-size: var(--fs-body);
  opacity: 0.72;
}

.coins-emoji {
  height: 104px;
  position: absolute;
  bottom: 0;
  right: 0;
}

/* Карточка списания и согласий (2-й скрин) */
.sign-card {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-radius: 32px;
}

.purple-account-card {
  padding: 22px 16px;
  border-radius: 24px;
  background: linear-gradient(90deg, #af78ff 0%, #561ea6 100%);
  color: #ffffff;
}

.purple-balance {
  font-size: 20px;
  font-weight: var(--fw-semibold);
}

.purple-label {
  margin-top: 4px;
  font-size: var(--fs-body);
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
  background: var(--button-primary-bg);
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

.contribution-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 240px;
  height: 240px;
}

.success-green-label {
  margin-top: 8px;
  font-size: var(--fs-sub);
  font-weight: var(--fw-medium);
  color: var(--color-primary);
}

.success-big-amount {
  margin-top: 8px;
  font-size: 24px;
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.success-rate-sub {
  margin-top: 8px;
  font-size: var(--fs-body);
  color: var(--text-muted);
}

.next-actions-wrap {
  width: 100%;
  margin-top: 48px;
  text-align: left;
}

.next-actions-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: var(--fs-sub);
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
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-surface-elevated);
  font-size: 16px;
}

.trio-label {
  font-size: var(--fs-caption);
  line-height: 1.25;
  color: var(--text-secondary);
}
</style>
