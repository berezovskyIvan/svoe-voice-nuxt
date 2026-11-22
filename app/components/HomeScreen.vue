<script setup lang="ts">
defineProps<{
  userName: string
  balance: number
}>()

const emit = defineEmits<{
  openMenu: []
  selectPrompt: [text: string]
  resetDemo: []
}>()

const promptCards = [
  {
    title: 'Заказать фермерские продукты',
    prompt: 'Закажи молоко, творог и яйца с доставкой на субботу утром',
    image: '/images/chips/products.webp',
    accent: 'rgba(46, 213, 52, 0.18)',
  },
  {
    title: 'Куда я тратил больше всего?',
    prompt: 'На что я больше всего потратила в этом месяце?',
    image: '/images/chips/deposits.webp',
    accent: 'rgba(59, 130, 246, 0.18)',
  },
  {
    title: 'Открыть вклад под 14%',
    prompt: 'Открой вклад под 14%',
    image: '/images/chips/money.webp',
    accent: 'rgba(139, 92, 246, 0.18)',
  },
  {
    title: 'Оплатить ЖКХ\nза ноябрь',
    prompt: 'Оплати ЖКХ за ноябрь',
    image: '/images/chips/utility.webp',
    accent: 'rgba(245, 158, 11, 0.18)',
  },
]
</script>

<template>
  <div class="home-screen">
    <div class="top-glow" />

    <header class="top-bar">
      <button
        type="button"
        aria-label="Открыть меню Зоя"
        class="icon-btn"
        @click="emit('openMenu')"
      >
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
    </header>

    <section class="hero-block">
      <h1 class="hero-title">
        Добрый день,<br />
        <span class="hero-accent">{{ userName || 'Екатерина' }}!</span><br />
        Чем помочь?
      </h1>

      <p class="hero-subtitle">
        Скажите голосом, что нужно сделать, — я открою нужный раздел и заполню данные
      </p>
    </section>

    <section class="prompts-section">
      <div class="prompts-header">
        <svg
          class="sparkle-icon"
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

        <span class="prompts-title">Попробуйте спросить</span>
      </div>

      <div class="prompts-grid">
        <button
          v-for="card in promptCards"
          :key="card.title"
          type="button"
          class="prompt-tile"
          :style="{ backgroundImage: `url(${card.image})` }"
          @click="emit('selectPrompt', card.prompt)"
        >
          <span class="tile-title">{{ card.title }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100dvh;
  padding: 16px 16px 84px;
  overflow: hidden;
}

.top-glow {
  position: absolute;
  inset: 0;
  background: var(--bg-top-glow);
  pointer-events: none;
  z-index: 0;
}

.top-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.icon-btn:active {
  transform: scale(0.93);
}

.hero-block {
  position: relative;
  z-index: 1;
  margin-top: 22px;
  margin-bottom: auto;
}

.hero-title {
  margin: 0;
  font-size: var(--fs-hero);
  font-weight: var(--fw-semibold);
  line-height: 1.18;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.hero-accent {
  color: var(--color-primary);
}

.hero-subtitle {
  margin: 12px 0 0;
  max-width: 310px;
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  line-height: 1.42;
  color: rgba(255, 255, 255, 0.72);
}

.prompts-section {
  position: relative;
  z-index: 1;
  margin-top: 24px;
}

.prompts-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: var(--fs-sub);
  font-weight: var(--fw-medium);
  color: var(--text-secondary);
}

.sparkle-icon {
  color: var(--color-primary);
  font-size: var(--fs-body);
}

.prompts-title {
  font-size: var(--fs-sub);
  font-weight: var(--fw-medium);
  line-height: 1.3;
  color: var(--text-secondary);
}

.prompts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.prompt-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  min-height: 88px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background-color: var(--bg-surface);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border: 1px solid var(--border-default);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.1s ease,
    border-color 0.15s ease;
}

.prompt-tile:hover {
  border-color: var(--color-primary-border);
}

.prompt-tile:active {
  transform: scale(0.97);
}

.tile-title {
  position: relative;
  z-index: 1;
  max-width: 132px;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  line-height: 1.3;
  color: var(--text-primary);
  white-space: pre-line;
}
</style>
