<script setup lang="ts">
import type {
  CreateOrderResponse,
  FarmerProductsPayload,
  ZoyaProductItem,
} from '~/types/zoya'
import { ZoyaApiError } from '~/composables/useZoyaApi'

const WEEKDAYS_ACCUSATIVE: Record<number, string> = {
  0: 'в воскресенье',
  1: 'в понедельник',
  2: 'во вторник',
  3: 'в среду',
  4: 'в четверг',
  5: 'в пятницу',
  6: 'в субботу',
}

const props = defineProps<{
  recognizedText: string
  payload: FarmerProductsPayload
  accountBalance?: number
}>()

const emit = defineEmits<{
  back: []
  openMenu: []
  selectPrompt: [text: string]
  completed: [newBalance: number]
}>()

const { confirmOrder, resolveImageUrl } = useZoyaApi()

const cartItems = ref<ZoyaProductItem[]>(props.payload.items.map((item) => ({ ...item })))

const step = ref<'cart' | 'success'>('cart')
const isSubmitting = ref(false)
const submitError = ref('')
const orderResult = ref<CreateOrderResponse | null>(null)
const idempotencyKey = ref<string>('')

watch(
  () => props.payload,
  (next) => {
    cartItems.value = next.items.map((item) => ({ ...item }))
    step.value = 'cart'
    submitError.value = ''
    idempotencyKey.value = ''
  },
)

const totalPrice = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.price * item.qty, 0),
)

const formattedDeliveryDate = computed(() => {
  const raw = props.payload.delivery?.date
  if (!raw) return 'в ближайшее время'
  try {
    const [y, m, d] = raw.split('-').map(Number)
    const date = new Date(Date.UTC(y!, m! - 1, d!))
    const weekday = WEEKDAYS_ACCUSATIVE[date.getUTCDay()] ?? ''
    const dayMonth = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
    }).format(date)

    return `${weekday}, ${dayMonth}`
  } catch {
    return raw
  }
})

function formatMoney(val: number): string {
  return new Intl.NumberFormat('ru-RU').format(val)
}

function updateQty(index: number, delta: number) {
  const item = cartItems.value[index]
  if (!item) return

  const nextQty = item.qty + delta
  if (nextQty <= 0) {
    cartItems.value.splice(index, 1)
  } else {
    item.qty = nextQty
  }
  submitError.value = ''
  idempotencyKey.value = ''
}

async function handleConfirmOrder() {
  if (cartItems.value.length === 0 || !props.payload.delivery || isSubmitting.value) {
    return
  }

  if (!idempotencyKey.value) {
    idempotencyKey.value = crypto.randomUUID()
  }

  isSubmitting.value = true
  submitError.value = ''

  try {
    const response = await confirmOrder(
      {
        items: cartItems.value.map((i) => ({ id: i.id, qty: i.qty })),
        expectedTotalPrice: totalPrice.value,
        deliveryDate: props.payload.delivery.date,
        deliverySlot: props.payload.delivery.slot,
      },
      idempotencyKey.value,
    )

    orderResult.value = response
    step.value = 'success'
    emit('completed', response.newBalance)
  } catch (err) {
    if (err instanceof ZoyaApiError) {
      if (err.code === 'PRICE_CHANGED' && err.details?.items) {
        cartItems.value = err.details.items.map((item) => ({ ...item }))
        idempotencyKey.value = ''
        submitError.value =
          'Цена или наличие товаров обновились. Проверьте новый итог и подтвердите заказ.'
        return
      }
      submitError.value = err.message
    } else {
      submitError.value = 'Не удалось оформить заказ. Попробуйте ещё раз.'
    }
  } finally {
    isSubmitting.value = false
  }
}

const extraSuggestions = [
  {
    title: 'Свежая выпечка и мёд',
    priceTag: 'от 180 ₽',
    prompt: 'Закажи фермерский сыр и сметану',
  },
  {
    title: 'Молочная корзина',
    priceTag: 'от 350 ₽',
    prompt: 'Закажи молоко 3,2% и творог 9%',
  },
]
</script>

<template>
  <div class="order-flow">
    <div class="top-glow" />

    <!-- ВЕРХНЯЯ ПАНЕЛЬ (бургер слева, крестик закрытия справа) -->
    <header class="top-bar">
      <button type="button" aria-label="Меню" class="icon-btn" @click="emit('openMenu')">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
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
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <!-- ЭКРАН 1: КОРЗИНА И ОФОРМЛЕНИЕ (экраны 4-6 на 1-м скрине) -->
    <template v-if="step === 'cart'">
      <!-- Плашка статуса «Заказ сформирован» (как на макете) -->
      <div class="order-status-banner">
        <img class="status-check-img" src="/images/check.webp" />
        <div class="status-text-col">
          <div class="status-heading">Заказ сформирован</div>
          <div class="status-subtext">Проверьте состав заказа и доставку</div>
        </div>
      </div>

      <div v-if="payload.unmatchedItems?.length" class="notice-warning">
        Не нашли в каталоге: {{ payload.unmatchedItems.join(', ') }}
      </div>

      <div v-if="payload.deliveryIssue === 'UNSUPPORTED_DELIVERY'" class="notice-warning">
        Выбранное время недоступно — подобрала ближайший утренний слот.
      </div>

      <!-- Секция: Товары в корзине -->
      <h2 class="section-title">Товары в корзине</h2>
      <div class="dark-card">
        <div v-if="cartItems.length === 0" class="empty-cart">
          Корзина пуста. Назовите продукты голосом или вернитесь назад.
        </div>

        <ul v-else class="items-list">
          <li v-for="(item, idx) in cartItems" :key="item.id" class="product-row">
            <img
              :src="resolveImageUrl(item.imageUrl)"
              :alt="item.name"
              class="product-img"
            />
            <div class="product-info">
              <div class="product-name">{{ item.name }}</div>
              <div class="product-unit">{{ item.unitLabel }}</div>

              <div class="product-controls-row">
                <div class="qty-pill">
                  <button
                    type="button"
                    class="qty-btn is-minus"
                    aria-label="Уменьшить"
                    @click="updateQty(idx, -1)"
                  >
                    −
                  </button>
                  <span class="qty-val">{{ item.qty }}</span>
                  <button
                    type="button"
                    class="qty-btn is-plus"
                    aria-label="Увеличить"
                    @click="updateQty(idx, 1)"
                  >
                    +
                  </button>
                </div>

                <div class="price-group">
                  <span
                    v-if="item.oldPrice && item.oldPrice > item.price"
                    class="item-old-price"
                  >
                    {{ formatMoney(item.oldPrice * item.qty) }} ₽
                  </span>
                  <span class="item-subtotal">
                    {{ formatMoney(item.price * item.qty) }} ₽
                  </span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Секция: Доставка и оплата -->
      <template v-if="payload.delivery && cartItems.length > 0">
        <h2 class="section-title">Доставка и оплата</h2>
        <div class="dark-card info-list">
          <div class="info-row">
            <svg
              class="info-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M13 0C13.5523 0 14 0.447715 14 1V2.02832C14.0867 2.03311 14.1708 2.03732 14.252 2.04395C14.814 2.08987 15.3311 2.18827 15.8164 2.43555C16.5689 2.81902 17.181 3.43109 17.5645 4.18359C17.8117 4.6689 17.9101 5.18599 17.9561 5.74805C18.0003 6.28924 18 6.95383 18 7.75879V12.2412C18 13.0462 18.0003 13.7108 17.9561 14.252C17.9101 14.814 17.8117 15.3311 17.5645 15.8164C17.181 16.5689 16.5689 17.181 15.8164 17.5645C15.3311 17.8117 14.814 17.9101 14.252 17.9561C13.7108 18.0003 13.0462 18 12.2412 18H5.75879C4.95381 18 4.28925 18.0003 3.74805 17.9561C3.18599 17.9101 2.6689 17.8117 2.18359 17.5645C1.43109 17.181 0.819016 16.5689 0.435547 15.8164C0.188272 15.3311 0.0898744 14.814 0.0439453 14.252C-0.000272036 13.7108 -1.27554e-05 13.0462 0 12.2412V7.75879C-1.27554e-05 6.95382 -0.000272036 6.28924 0.0439453 5.74805C0.0898741 5.18599 0.188271 4.6689 0.435547 4.18359C0.819015 3.43109 1.43109 2.81902 2.18359 2.43555C2.6689 2.18827 3.18599 2.08987 3.74805 2.04395C3.82918 2.03732 3.91327 2.03311 4 2.02832V1C4 0.447715 4.44772 0 5 0C5.55228 0 6 0.447715 6 1V2H12V1C12 0.447715 12.4477 0 13 0ZM5.7998 4C4.94341 4 4.36117 4.00035 3.91113 4.03711C3.47272 4.07293 3.2482 4.13808 3.0918 4.21777C2.71554 4.40951 2.40951 4.71554 2.21777 5.0918C2.13808 5.2482 2.07293 5.47272 2.03711 5.91113C2.00035 6.36117 2 6.94341 2 7.7998V12.2002C2 13.0566 2.00035 13.6388 2.03711 14.0889C2.07293 14.5273 2.13808 14.7518 2.21777 14.9082C2.40951 15.2845 2.71554 15.5905 3.0918 15.7822C3.2482 15.8619 3.47272 15.9271 3.91113 15.9629C4.36117 15.9997 4.94341 16 5.7998 16H12.2002C13.0566 16 13.6388 15.9997 14.0889 15.9629C14.5273 15.9271 14.7518 15.8619 14.9082 15.7822C15.2845 15.5905 15.5905 15.2845 15.7822 14.9082C15.8619 14.7518 15.9271 14.5273 15.9629 14.0889C15.9997 13.6388 16 13.0566 16 12.2002V7.7998C16 6.94341 15.9997 6.36117 15.9629 5.91113C15.9271 5.47272 15.8619 5.2482 15.7822 5.0918C15.5905 4.71554 15.2845 4.40951 14.9082 4.21777C14.7518 4.13808 14.5273 4.07293 14.0889 4.03711C13.6388 4.00035 13.0566 4 12.2002 4H5.7998Z"
                fill="#55D440"
              />
            </svg>
            <div>
              <div class="info-label">Доставка</div>
              <div class="info-val">
                {{ formattedDeliveryDate }} · {{ payload.delivery.slot }}
              </div>
            </div>
          </div>

          <div class="info-row">
            <svg
              class="info-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="20"
              viewBox="0 0 18 20"
              fill="none"
            >
              <path
                d="M9 0C13.9706 3.86554e-07 18 4.02944 18 9C18 12.0264 16.1898 14.5922 14.1045 16.3994L10.6631 19.3818C9.70852 20.2088 8.29148 20.2088 7.33691 19.3818L3.89551 16.3994C1.81022 14.5922 1.42577e-06 12.0264 0 9C0 4.02944 4.02944 0 9 0ZM9 2C5.13401 2 2 5.13401 2 9C2 11.2061 3.33624 13.268 5.20508 14.8877L8.64648 17.8701C8.84944 18.046 9.15057 18.046 9.35352 17.8701L12.7949 14.8877C14.6638 13.268 16 11.2061 16 9C16 5.13401 12.866 2 9 2ZM9 7C10.1046 7 11 7.89543 11 9C11 10.1046 10.1046 11 9 11C7.89543 11 7 10.1046 7 9C7 7.89543 7.89543 7 9 7Z"
                fill="#55D440"
              />
            </svg>
            <div>
              <div class="info-label">Адрес</div>
              <div class="info-val">{{ payload.delivery.address }}</div>
            </div>
          </div>

          <div class="info-row">
            <svg
              class="info-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M6 14C7.10457 14 8 14.8954 8 16C8 17.1046 7.10457 18 6 18C4.89543 18 4 17.1046 4 16C4 14.8954 4.89543 14 6 14ZM14 14C15.1046 14 16 14.8954 16 16C16 17.1046 15.1046 18 14 18C12.8954 18 12 17.1046 12 16C12 14.8954 12.8954 14 14 14ZM1.36035 0C2.7904 0 4.0213 1.00984 4.30176 2.41211L4.41992 3H15.4971C17.1552 3.00013 18.3537 4.58513 17.9023 6.18066L16.874 9.81641C16.5087 11.1081 15.3297 12 13.9873 12H6.63965C5.20961 12 3.9787 10.9902 3.69824 9.58789L2.34082 2.80371C2.24726 2.33639 1.83697 2 1.36035 2H1C0.447716 2 1.93278e-06 1.55228 0 1C0 0.447715 0.447715 0 1 0H1.36035ZM5.65918 9.19629C5.75274 9.66361 6.16304 10 6.63965 10H13.9873C14.4346 9.99997 14.8273 9.70283 14.9492 9.27246L15.9775 5.63574C16.0676 5.31676 15.8285 5.00013 15.4971 5H4.81934L5.65918 9.19629Z"
                fill="#55D440"
              />
            </svg>
            <div>
              <div class="info-label">Оплата</div>
              <div class="info-val">
                Текущий счёт · {{ formatMoney(accountBalance ?? 1800000) }} ₽
              </div>
            </div>
          </div>
        </div>

        <!-- Секция: Итого -->
        <h2 class="section-title">Итого</h2>
        <div class="dark-card summary-list">
          <div class="summary-row">
            <span>Товары ({{ cartItems.length }})</span>
            <span>{{ formatMoney(totalPrice) }} ₽</span>
          </div>
          <div class="summary-row">
            <span>Доставка</span>
            <span class="free-text">Бесплатно</span>
          </div>
          <div class="summary-row">
            <span>Сумма к оформлению</span>
            <span>{{ formatMoney(totalPrice) }} ₽</span>
          </div>
        </div>

        <div v-if="submitError" class="notice-error">
          {{ submitError }}
        </div>

        <div class="cta-footer">
          <button
            type="button"
            :disabled="isSubmitting"
            class="primary-cta-btn"
            @click="handleConfirmOrder"
          >
            {{
              isSubmitting ? 'Оформляю заказ...' : `Оплатить ${formatMoney(totalPrice)} ₽`
            }}
          </button>
        </div>
      </template>
    </template>

    <!-- ЭКРАН 2: ВАШ ЗАКАЗ ОФОРМЛЕН! (7-й экран на 1-м скрине) -->
    <template v-else-if="step === 'success' && orderResult">
      <div class="success-screen">
        <img class="cow-illustration" src="/images/cow.webp" />
        <h1 class="success-heading">Ваш заказ оформлен!</h1>
        <p class="success-subtext">
          Заказ №{{ orderResult.orderId }} на сумму
          {{ formatMoney(orderResult.totalPrice) }} ₽ принят. Доставим
          {{ formattedDeliveryDate }} ({{ payload.delivery?.slot }}).
        </p>

        <div class="extra-section">
          <div class="extra-header">
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

            <span class="extra-sparkle-title">Заказать что-нибудь ещё?</span>
          </div>

          <div class="extra-grid">
            <button
              v-for="card in extraSuggestions"
              :key="card.title"
              type="button"
              class="extra-card"
              @click="emit('selectPrompt', card.prompt)"
            >
              <span class="extra-badge">{{ card.priceTag }}</span>
              <span class="extra-title">{{ card.title }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.order-flow {
  position: relative;
  min-height: 100dvh;
  padding: 16px 16px 166px;
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

.order-status-banner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding: 10px 16px;
  border-radius: 20px;
  background: var(--bg-surface);
}

.status-check-img {
  width: 32px;
  height: 32px;
}

.status-text-col {
  min-width: 0;
}

.status-heading {
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  line-height: 1.3;
  color: var(--text-primary);
}

.status-subtext {
  margin-top: 2px;
  font-size: var(--fs-caption);
  font-weight: var(--fw-regular);
  line-height: 1.35;
  color: var(--text-muted);
}

.brand-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: #ffffff;
  color: #080a08;
  font-size: var(--fs-micro);
  font-weight: var(--fw-semibold);
  letter-spacing: 0.04em;
}

.reply-text {
  margin: 10px 0 0;
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-regular);
  line-height: 1.4;
  color: var(--text-primary);
}

.section-title {
  position: relative;
  z-index: 1;
  margin: 18px 0 12px;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
  line-height: 1.25;
  color: var(--text-primary);
}

.dark-card {
  position: relative;
  z-index: 1;
  padding: 16px;
  border-radius: 32px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
}

.notice-warning {
  position: relative;
  z-index: 1;
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-size: var(--fs-caption);
  font-weight: var(--fw-regular);
  line-height: 1.4;
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
  font-weight: var(--fw-regular);
}

.empty-cart {
  padding: 20px 12px;
  text-align: center;
  font-size: var(--fs-body);
  color: var(--text-muted);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.product-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.product-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.product-img {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  object-fit: cover;
  background: var(--bg-surface-elevated);
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  line-height: 1.3;
  color: var(--text-primary);
}

.product-unit {
  margin-top: 2px;
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}

.product-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.qty-pill {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  min-width: 96px;
  height: 30px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--bg-surface-elevated);
}

.qty-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.1s ease;
}

.qty-btn:active {
  transform: scale(0.9);
}

.qty-btn.is-minus {
  color: var(--text-muted);
}

.qty-btn.is-plus {
  color: var(--color-primary);
}

.qty-val {
  min-width: 18px;
  text-align: center;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

.price-group {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.item-old-price {
  font-size: var(--fs-sub);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
  text-decoration: line-through;
}

.item-subtotal {
  font-size: var(--fs-body);
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.info-icon {
  width: 18px;
  height: 18px;
}

.info-label {
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}

.info-val {
  margin-top: 2px;
  font-size: var(--fs-sub);
  font-weight: var(--fw-regular);
  line-height: 1.35;
  color: var(--text-primary);
  text-transform: capitalize;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}

.free-text {
  color: var(--color-primary);
  font-weight: var(--fw-regular);
}

.cta-footer {
  position: fixed;
  left: 50%;
  bottom: 74px;
  transform: translateX(-50%);
  z-index: 35;
  width: 100%;
  max-width: 100vw;
  padding: 16px;
  background-color: var(--bg-surface);
  border-top-left-radius: 32px;
  border-top-right-radius: 32px;
}

.primary-cta-btn {
  width: 100%;
  height: 48px;
  padding: 0 20px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--button-primary-bg);
  color: #ffffff;
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    background-color 0.15s ease;
}

.primary-cta-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.primary-cta-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Экран 7: Ваш заказ оформлен! */
.success-screen {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 24px;
}

.cow-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 240px;
  height: 240px;
}

.success-heading {
  margin: 8px 0;
  font-size: 26px;
  font-weight: var(--fw-semibold);
  line-height: 1.25;
  color: var(--text-primary);
}

.success-subtext {
  margin: 0;
  max-width: 295px;
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  line-height: 1.42;
  color: var(--text-muted);
}

.extra-section {
  width: 100%;
  margin-top: 32px;
  text-align: left;
}

.extra-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: var(--fs-sub);
  font-weight: var(--fw-medium);
  color: var(--text-secondary);
}

.sparkle {
  color: var(--color-primary);
  font-size: var(--fs-body);
}

.extra-sparkle-title {
  font-size: var(--fs-sub);
  font-weight: var(--fw-medium);
  line-height: 1.3;
  color: var(--text-secondary);
}

.extra-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.extra-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  min-height: 86px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  text-align: left;
  cursor: pointer;
}

.extra-badge {
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-size: var(--fs-micro);
  font-weight: var(--fw-semibold);
}

.extra-title {
  margin-top: 10px;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  line-height: 1.3;
  color: var(--text-primary);
}
</style>
