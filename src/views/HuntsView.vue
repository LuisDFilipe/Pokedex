<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface Hunt {
  id: string
  target: string
  resets: number
  createdAt: string
}

const STORAGE_KEY = 'pokedex-hunts'

const hunts = ref<Hunt[]>([])
const target = ref('')
const error = ref('')

const totalResets = computed(() => hunts.value.reduce((total, hunt) => total + hunt.resets, 0))

const isHunt = (value: unknown): value is Hunt =>
  typeof value === 'object'
  && value !== null
  && 'id' in value
  && typeof value.id === 'string'
  && 'target' in value
  && typeof value.target === 'string'
  && 'resets' in value
  && typeof value.resets === 'number'
  && Number.isSafeInteger(value.resets)
  && value.resets >= 0
  && 'createdAt' in value
  && typeof value.createdAt === 'string'

const saveHunts = (updatedHunts: Hunt[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHunts))
    hunts.value = updatedHunts
    error.value = ''
    return true
  } catch (err) {
    error.value = `Unable to save hunts: ${err instanceof Error ? err.message : String(err)}`
    return false
  }
}

const addHunt = () => {
  const huntTarget = target.value.trim()
  if (!huntTarget) return

  const newHunt: Hunt = {
    id: crypto.randomUUID(),
    target: huntTarget,
    resets: 0,
    createdAt: new Date().toISOString(),
  }

  if (saveHunts([newHunt, ...hunts.value])) {
    target.value = ''
  }
}

const changeResets = (hunt: Hunt, amount: number) => {
  const updatedHunts = hunts.value.map((current) =>
    current.id === hunt.id
      ? { ...current, resets: Math.max(0, current.resets + amount) }
      : current,
  )
  saveHunts(updatedHunts)
}

const removeHunt = (hunt: Hunt) => {
  if (!window.confirm(`Remove the ${hunt.target} hunt and its reset count?`)) return
  saveHunts(hunts.value.filter((current) => current.id !== hunt.id))
}

onMounted(() => {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY)
    if (!storedValue) return

    const parsed: unknown = JSON.parse(storedValue)
    if (!Array.isArray(parsed) || !parsed.every(isHunt)) {
      throw new Error('Saved hunt data is invalid.')
    }

    hunts.value = parsed
  } catch (err) {
    error.value = `Unable to load hunts: ${err instanceof Error ? err.message : String(err)}`
  }
})
</script>

<template>
  <section class="hunts-view">
    <header class="hunts-hero">
      <div>
        <p class="eyebrow">Hunt tracker</p>
        <h2>Every reset brings you closer</h2>
        <p class="hero-copy">Keep a separate counter for each hunt. Your hunts are saved in this browser.</p>
      </div>
      <div class="total-card" aria-live="polite">
        <span class="total-label">Total resets</span>
        <strong>{{ totalResets.toLocaleString() }}</strong>
        <span class="total-helper">across {{ hunts.length }} {{ hunts.length === 1 ? 'hunt' : 'hunts' }}</span>
      </div>
    </header>

    <p v-if="error" class="status error" role="alert">{{ error }}</p>

    <form class="add-hunt panel" @submit.prevent="addHunt">
      <label for="hunt-target">What are you hunting?</label>
      <div class="add-controls">
        <input
          id="hunt-target"
          v-model="target"
          type="text"
          maxlength="80"
          placeholder="e.g. Mewtwo"
          autocomplete="off"
          required
        >
        <button type="submit" class="primary-button">Add hunt</button>
      </div>
    </form>

    <div v-if="hunts.length" class="hunt-grid">
      <article v-for="hunt in hunts" :key="hunt.id" class="hunt-card">
        <div class="hunt-heading">
          <div>
            <p class="hunt-kicker">Target</p>
            <h3>{{ hunt.target }}</h3>
          </div>
          <button
            type="button"
            class="remove-button"
            :aria-label="`Remove ${hunt.target} hunt`"
            @click="removeHunt(hunt)"
          >
            Remove
          </button>
        </div>

        <p class="started-date">Started {{ new Date(hunt.createdAt).toLocaleDateString() }}</p>

        <div class="counter">
          <button
            type="button"
            class="counter-button"
            :aria-label="`Decrease ${hunt.target} reset count`"
            :disabled="hunt.resets === 0"
            @click="changeResets(hunt, -1)"
          >
            −
          </button>
          <div class="counter-value" aria-live="polite">
            <strong>{{ hunt.resets.toLocaleString() }}</strong>
            <span>resets</span>
          </div>
          <button
            type="button"
            class="counter-button increment"
            :aria-label="`Add a reset to ${hunt.target}`"
            @click="changeResets(hunt, 1)"
          >
            +
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state panel">
      <span class="empty-icon" aria-hidden="true">✦</span>
      <h3>No hunts yet</h3>
      <p>Add your first Hunt above and start counting resets.</p>
    </div>
  </section>
</template>

<style scoped>
.hunts-view {
  display: grid;
  gap: 20px;
  padding: 12px;
  color: #f4f4f4;
}

.hunts-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(255, 201, 60, 0.2), transparent 30%),
    linear-gradient(135deg, rgba(255, 71, 71, 0.24), rgba(22, 22, 22, 0.94));
}

.eyebrow,
.hunt-kicker {
  margin: 0;
  color: #ffb0b0;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hunts-hero h2 {
  margin: 8px 0;
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  font-weight: 800;
}

.hero-copy,
.started-date,
.empty-state p {
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
}

.total-card,
.panel,
.hunt-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(14, 14, 14, 0.92);
}

.total-card {
  display: grid;
  flex: 0 0 auto;
  gap: 4px;
  min-width: 150px;
  padding: 16px 20px;
  text-align: center;
}

.total-label,
.total-helper {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.88rem;
}

.total-card strong {
  color: #ffcf5c;
  font-size: 2rem;
}

.panel {
  padding: 18px;
}

.add-hunt label {
  display: block;
  margin-bottom: 10px;
  font-weight: 700;
}

.add-controls {
  display: flex;
  gap: 10px;
}

.add-controls input {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid #3b3b3b;
  border-radius: 10px;
  background: #101010;
  color: #fff;
  font: inherit;
}

.add-controls input:focus-visible,
button:focus-visible {
  outline: 2px solid #ffcf5c;
  outline-offset: 2px;
}

.primary-button,
.remove-button,
.counter-button {
  border: 0;
  border-radius: 10px;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.primary-button {
  padding: 0 20px;
  background: #d94343;
}

.primary-button:hover {
  background: #f05252;
}

.hunt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr));
  gap: 14px;
}

.hunt-card {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.hunt-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.hunt-heading h3 {
  margin: 6px 0 0;
  font-size: 1.35rem;
  overflow-wrap: anywhere;
}

.remove-button {
  padding: 7px 10px;
  background: transparent;
  color: #ff9a9a;
}

.remove-button:hover {
  background: rgba(255, 71, 71, 0.12);
}

.started-date {
  font-size: 0.88rem;
}

.counter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
}

.counter-button {
  width: 48px;
  height: 48px;
  background: #292929;
  font-size: 1.6rem;
}

.counter-button:hover:not(:disabled) {
  background: #3a3a3a;
}

.counter-button:disabled {
  color: #666;
  cursor: not-allowed;
}

.counter-button.increment {
  background: #d94343;
}

.counter-button.increment:hover {
  background: #f05252;
}

.counter-value {
  display: grid;
  justify-items: center;
}

.counter-value strong {
  font-size: 2rem;
}

.counter-value span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.84rem;
}

.empty-state {
  display: grid;
  justify-items: center;
  padding: 44px 20px;
  text-align: center;
}

.empty-icon {
  color: #ffcf5c;
  font-size: 2rem;
}

.empty-state h3 {
  margin: 10px 0 6px;
}

.status.error {
  margin: 0;
  color: #ff9a9a;
}

@media (max-width: 600px) {
  .hunts-hero {
    align-items: stretch;
    flex-direction: column;
    padding: 20px;
  }

  .total-card {
    grid-template-columns: 1fr auto;
    align-items: center;
    text-align: left;
  }

  .total-card strong {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .add-controls {
    flex-direction: column;
  }

  .primary-button {
    padding: 12px;
  }
}
</style>
