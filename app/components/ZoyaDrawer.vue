<script setup lang="ts">
import type { HistoryItem } from '@/types/zoya'

defineProps<{
  isOpen: boolean
  userName: string
  balance: number
  history: HistoryItem[]
  isLoading?: boolean
}>()

const emit = defineEmits<{
  close: []
  selectSkill: [promptText: string]
  resetDemo: []
}>()

const skillChips = [
  { label: 'Платежи', prompt: '', active: false },
  {
    label: 'Вклады',
    prompt: 'Открой вклад под 14%',
    active: true,
  },
  { label: 'Кредиты', prompt: '', active: false },
  { label: 'Путешествия', prompt: '', active: false },
  {
    label: 'Фермерские продукты',
    prompt: 'Закажи молоко, творог и яйца с доставкой на субботу утром',
    active: true,
  },
  {
    label: 'Аналитика трат',
    prompt: 'На что я больше всего потратила в этом месяце?',
    active: true,
  },
]

function formatHistoryMeta(item: HistoryItem): string {
  const parts: string[] = []
  if (item.amount !== null) {
    const abs = new Intl.NumberFormat('ru-RU').format(Math.abs(item.amount))
    parts.push(`${abs} ₽`)
  } else if (item.subtitle) {
    parts.push(item.subtitle)
  }

  try {
    const date = new Date(item.createdAt)
    const now = new Date()
    const isToday =
      date.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) ===
      now.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })

    const timeStr = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)

    if (isToday) {
      parts.push(`Сегодня, ${timeStr}`)
    } else {
      const dateStr = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date)
      parts.push(`${dateStr}, ${timeStr}`)
    }
  } catch {
    // ignore date parse error
  }

  return parts.join(' · ')
}

function handleSkillClick(chip: { prompt: string; active: boolean }) {
  if (!chip.active || !chip.prompt) {
    return
  }
  emit('close')
  emit('selectSkill', chip.prompt)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="isOpen" class="drawer-backdrop" @click.self="emit('close')">
        <aside class="drawer-panel">
          <div class="top-glow" />

          <header class="drawer-header">
            <img
              src="/images/zoya-avatar.webp"
              alt="Ассистент Зоя"
              class="zoya-mascot-img"
              @dblclick="emit('resetDemo')"
            />
            <div>
              <div class="zoya-title">Зоя</div>
              <div class="zoya-subtitle">Ваш помощник</div>
            </div>

            <button
              type="button"
              aria-label="Закрыть меню"
              class="close-btn"
              @click="emit('close')"
            >
              <svg
                width="20"
                height="20"
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
          </header>

          <section class="drawer-section">
            <h2 class="section-heading">Что я умею</h2>
            <div class="chips-wrap">
              <button
                v-for="chip in skillChips"
                :key="chip.label"
                type="button"
                class="skill-pill"
                :class="{ 'is-disabled': !chip.active }"
                @click="handleSkillClick(chip)"
              >
                {{ chip.label }}
              </button>
            </div>
          </section>

          <section class="drawer-section history-section">
            <div class="section-row">
              <h2 class="section-heading">История</h2>
              <span v-if="isLoading" class="sync-label">Обновляю...</span>
            </div>

            <div v-if="history.length === 0" class="history-card empty-state">
              История операций пока пуста
            </div>

            <div v-else class="history-card">
              <div v-for="item in history" :key="item.id" class="history-row">
                <div class="history-content">
                  <div class="history-title">{{ item.title }}</div>
                  <div class="history-meta">{{ formatHistoryMeta(item) }}</div>
                </div>
                <svg
                  class="chevron-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  background: var(--bg-overlay);
}

.drawer-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 440px;
  height: 100%;
  background: var(--bg-app);
  overflow: hidden;
}

.top-glow {
  position: absolute;
  inset: 0;
  background: var(--bg-glow-compact);
  pointer-events: none;
  z-index: 0;
}

.drawer-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;
}

.zoya-mascot-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  cursor: pointer;
  margin-right: 10px;
}

.zoya-title {
  margin: 0;
  font-size: 16px;
  font-weight: var(--fw-medium);
  line-height: 1.25;
  color: var(--text-primary);
}

.zoya-subtitle {
  margin: 2px 0 0;
  font-size: var(--fs-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}

.close-btn {
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
  margin-left: auto;
}

.drawer-section {
  position: relative;
  z-index: 1;
  padding: 20px 16px 4px;
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-heading {
  margin: 0 0 12px;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
  line-height: 1.25;
  color: var(--text-primary);
}

.sync-label {
  font-size: var(--fs-caption);
  color: var(--color-primary);
}

.chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-pill {
  padding: 8px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  font-size: var(--fs-sub);
  font-weight: var(--fw-medium);
  line-height: 1.3;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    transform 0.1s ease;
}

.skill-pill:not(.is-disabled):hover {
  background: var(--color-primary-soft);
  color: var(--text-accent);
}

.skill-pill:not(.is-disabled):active {
  transform: scale(0.96);
}

.skill-pill.is-disabled {
  opacity: 0.72;
  cursor: default;
}

.history-section {
  flex: 1;
  overflow-y: auto;
  padding-top: 16px;
  padding-bottom: 84px;
}

.history-card {
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  font-size: var(--fs-body);
  color: var(--text-muted);
}

.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.history-row:last-child {
  border-bottom: none;
}

.history-content {
  min-width: 0;
  flex: 1;
}

.history-title {
  margin: 0;
  font-size: var(--fs-sub);
  font-weight: var(--fw-regular);
  line-height: 1.35;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  margin: 3px 0 0;
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  line-height: 1.35;
  color: var(--text-muted);
}

.chevron-icon {
  color: var(--text-primary);
  flex-shrink: 0;
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
