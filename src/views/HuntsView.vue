<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface Hunt {
  id: string
  target: string
  resets: number
  createdAt: string
  odds?: number
  completed?: boolean
  completedAt?: string
}

const STORAGE_KEY = 'pokedex-hunts'
const DEFAULT_ODDS = 4096

const hunts = ref<Hunt[]>([])
const target = ref('')
const error = ref('')
const editingHuntId = ref<string | null>(null)
const oddsDraft = ref({ odds: '', resets: '' })
const fullscreenHuntId = ref<string | null>(null)

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
  && (!('odds' in value)
    || (typeof value.odds === 'number' && Number.isSafeInteger(value.odds) && value.odds > 0))
  && (!('completed' in value) || typeof value.completed === 'boolean')
  && (!('completedAt' in value) || typeof value.completedAt === 'string')

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
    odds: DEFAULT_ODDS,
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

const editOdds = (hunt: Hunt) => {
  editingHuntId.value = hunt.id
  oddsDraft.value = {
    odds: String(hunt.odds ?? DEFAULT_ODDS),
    resets: String(hunt.resets),
  }
  error.value = ''
}

const cancelOddsEdit = () => {
  editingHuntId.value = null
  oddsDraft.value = { odds: '', resets: '' }
}

const saveHuntEdit = (hunt: Hunt) => {
  const oddsInput = String(oddsDraft.value.odds).trim()
  const resetsInput = String(oddsDraft.value.resets).trim()
  const odds = Number(oddsInput)
  const resets = Number(resetsInput)
  if (!oddsInput || !Number.isSafeInteger(odds) || odds < 1) {
    error.value = 'Odds must be a whole number greater than 0.'
    return
  }
  if (!resetsInput || !Number.isSafeInteger(resets) || resets < 0) {
    error.value = 'Encounters must be a whole number greater than or equal to 0.'
    return
  }

  const updatedHunts = hunts.value.map((current) =>
    current.id === hunt.id ? { ...current, odds, resets } : current,
  )
  if (saveHunts(updatedHunts)) cancelOddsEdit()
}

const cumulativeChance = (hunt: Hunt) => {
  if (hunt.resets === 0) return 0
  const odds = hunt.odds ?? DEFAULT_ODDS
  if (odds === 1) return 100
  return -Math.expm1(hunt.resets * Math.log1p(-1 / odds)) * 100
}

const toggleHuntCompleted = (hunt: Hunt) => {
  const completedAt = new Date().toISOString()
  saveHunts(hunts.value.map((current) =>
    current.id === hunt.id
      ? current.completed
        ? { ...current, completed: false, completedAt: undefined }
        : { ...current, completed: true, completedAt }
      : current,
  ))
}

const updateFullscreenState = () => {
  fullscreenHuntId.value = document.fullscreenElement
    ?.closest<HTMLElement>('.hunt-card')
    ?.dataset.huntId ?? null
}

const toggleFullscreen = async (event: MouseEvent) => {
  const button = event.currentTarget
  if (!(button instanceof HTMLElement)) {
    error.value = 'Unable to find the hunt card to display fullscreen.'
    return
  }
  const card = button.closest<HTMLElement>('.hunt-card')
  if (!card) {
    error.value = 'Unable to find the hunt card to display fullscreen.'
    return
  }

  try {
    if (document.fullscreenElement === card) {
      await document.exitFullscreen()
    } else {
      await card.requestFullscreen()
    }
    error.value = ''
  } catch (err) {
    error.value = `Unable to change fullscreen mode: ${err instanceof Error ? err.message : String(err)}`
  }
}

const handleFullscreenClick = (hunt: Hunt, event: MouseEvent) => {
  if (fullscreenHuntId.value !== hunt.id) return

  const target = event.target
  if (target instanceof Element && target.closest('.fullscreen-button')) return

  changeResets(hunt, 1)
}

const removeHunt = (hunt: Hunt) => {
  if (!window.confirm(`Remove the ${hunt.target} hunt and its reset count?`)) return
  saveHunts(hunts.value.filter((current) => current.id !== hunt.id))
}

onMounted(() => {
  document.addEventListener('fullscreenchange', updateFullscreenState)

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

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenState)
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
      <article
        v-for="hunt in hunts"
        :key="hunt.id"
        class="hunt-card"
        :class="{ completed: hunt.completed }"
        :data-hunt-id="hunt.id"
        @click="handleFullscreenClick(hunt, $event)"
      >
        <div class="hunt-heading">
          <div class="hunt-title">
            <h3>{{ hunt.target }}</h3>
          </div>
          <div class="hunt-actions">
            <button
              v-if="!hunt.completed && (fullscreenHuntId === hunt.id || editingHuntId !== hunt.id)"
              type="button"
              class="fullscreen-button"
              :aria-label="fullscreenHuntId === hunt.id ? `Exit fullscreen for ${hunt.target}` : `Make ${hunt.target} fullscreen`"
              :title="fullscreenHuntId === hunt.id ? 'Exit fullscreen' : 'Fullscreen'"
              @click="toggleFullscreen"
            >
              <svg
                v-if="fullscreenHuntId === hunt.id"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
            <button
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id"
              type="button"
              :class="editingHuntId === hunt.id ? 'save-edit-button' : 'edit-button'"
              :aria-label="editingHuntId === hunt.id ? `Save ${hunt.target} changes` : `Edit ${hunt.target} hunt`"
              :title="editingHuntId === hunt.id ? 'Save changes' : 'Edit hunt'"
              @click="editingHuntId === hunt.id ? saveHuntEdit(hunt) : editOdds(hunt)"
            >
              <svg
                v-if="editingHuntId === hunt.id"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 3h12l4 4v14H3V3h2Z" />
                <path d="M7 3v6h10V3" />
                <path d="M7 21v-8h10v8" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.77 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.92 4.77h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
            <button
              v-if="fullscreenHuntId !== hunt.id"
              type="button"
              :class="hunt.completed ? 'reopen-button' : 'complete-button'"
              :aria-pressed="Boolean(hunt.completed)"
              :aria-label="hunt.completed ? `Reopen ${hunt.target} hunt` : `Complete ${hunt.target} hunt`"
              :title="hunt.completed ? 'Reopen hunt' : 'Complete hunt'"
              @click="toggleHuntCompleted(hunt)"
            >
              <svg
                v-if="hunt.completed"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </button>
            <button
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id"
              type="button"
              class="remove-button"
              :aria-label="`Remove ${hunt.target} hunt`"
              title="Remove hunt"
              @click="removeHunt(hunt)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="m19 6-1 14H6L5 6" />
                <path d="M10 11v5M14 11v5" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="fullscreenHuntId !== hunt.id" class="hunt-details">
          <p class="started-date">
            <template v-if="hunt.completed">
              Ended {{ hunt.completedAt ? new Date(hunt.completedAt).toLocaleDateString() : 'date unavailable' }}
            </template>
            <template v-else>
              Started {{ new Date(hunt.createdAt).toLocaleDateString() }}
            </template>
          </p>
          <p v-if="!hunt.completed && editingHuntId !== hunt.id" class="odds-summary">
            Odds: 1 in {{ (hunt.odds ?? DEFAULT_ODDS).toLocaleString() }}
          </p>
        </div>

        <form
          v-if="editingHuntId === hunt.id && fullscreenHuntId !== hunt.id"
          class="odds-editor"
          @submit.prevent="saveHuntEdit(hunt)"
        >
          <div class="odds-fields">
            <label :for="`odds-${hunt.id}`">
              <span>Odds <small>(1 in N)</small></span>
              <input
                :id="`odds-${hunt.id}`"
                v-model="oddsDraft.odds"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                required
              >
            </label>
            <label :for="`encounters-${hunt.id}`">
              <span>Encounters</span>
              <input
                :id="`encounters-${hunt.id}`"
                v-model="oddsDraft.resets"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                required
              >
            </label>
          </div>
          <button type="submit" class="visually-hidden-submit" tabindex="-1" aria-hidden="true"></button>
          <button type="button" class="cancel-button" @click="cancelOddsEdit">Cancel</button>
        </form>

        <div class="hunt-progress">
          <div class="counter" :class="{ 'completed-counter': hunt.completed }">
            <button
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id"
              type="button"
              class="counter-button"
              :aria-label="`Decrease ${hunt.target} reset count`"
              :disabled="hunt.resets === 0"
              @click="changeResets(hunt, -1)"
            >
              −
            </button>
            <div
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id"
              class="counter-value"
            >
              <strong>{{ hunt.resets.toLocaleString() }}</strong>
              <span>encounters</span>
            </div>
            <div
              v-else
              class="counter-value"
              :class="{ 'fullscreen-count': fullscreenHuntId === hunt.id }"
              :role="fullscreenHuntId === hunt.id ? 'button' : undefined"
              :tabindex="fullscreenHuntId === hunt.id ? 0 : undefined"
              :aria-label="fullscreenHuntId === hunt.id ? `Add one encounter to ${hunt.target}` : undefined"
              aria-live="polite"
              @keydown.enter.prevent="fullscreenHuntId === hunt.id && changeResets(hunt, 1)"
              @keydown.space.prevent="fullscreenHuntId === hunt.id && changeResets(hunt, 1)"
            >
              <strong>{{ hunt.resets.toLocaleString() }}</strong>
              <span>encounters</span>
            </div>
            <button
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id"
              type="button"
              class="counter-button increment"
              :aria-label="`Add a reset to ${hunt.target}`"
              @click="changeResets(hunt, 1)"
            >
              +
            </button>
          </div>
          <p v-if="!hunt.completed" class="cumulative-chance">
            Cumulative chance <strong>{{ cumulativeChance(hunt).toLocaleString(undefined, { maximumFractionDigits: 2 }) }}%</strong>
          </p>
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
.edit-button,
.save-edit-button,
.remove-button,
.cancel-button,
.counter-button {
  border: 0;
  border-radius: 10px;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.edit-button,
.save-edit-button,
.remove-button {
  padding: 7px 10px;
  background: transparent;
}

.edit-button {
  color: #ffcf5c;
}

.save-edit-button {
  color: #b7ee9b;
}

.edit-button,
.save-edit-button,
.fullscreen-button,
.complete-button,
.reopen-button,
.remove-button {
  display: inline-grid;
  box-sizing: border-box;
  width: 34px;
  height: 34px;
  padding: 7px;
  place-items: center;
  flex: 0 0 auto;
  line-height: 0;
}

.edit-button svg,
.save-edit-button svg,
.fullscreen-button svg,
.complete-button svg,
.reopen-button svg,
.remove-button svg {
  display: block;
  width: 18px;
  height: 18px;
  margin: auto;
}

.edit-button:hover {
  background: rgba(255, 207, 92, 0.12);
}

.save-edit-button:hover {
  background: rgba(122, 199, 76, 0.14);
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
  min-width: 0;
  align-content: start;
  gap: 12px;
  padding: 16px;
}

.hunt-card.completed {
  border-color: rgba(122, 199, 76, 0.4);
}

.hunt-card:fullscreen {
  box-sizing: border-box;
  display: grid;
  width: 100vw;
  min-height: 100vh;
  height: 100dvh;
  grid-template-rows: auto 1fr;
  align-content: stretch;
  justify-items: stretch;
  gap: clamp(20px, 4vh, 40px);
  padding: clamp(24px, 6vw, 80px);
  border: 0;
  border-radius: 0;
  overflow: auto;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  background: #000;
}

.hunt-card:fullscreen .hunt-heading {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 24px;
}

.hunt-card:fullscreen .hunt-heading h3 {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 6rem);
  letter-spacing: -0.04em;
  line-height: 1;
}

.hunt-card:fullscreen .hunt-actions {
  justify-content: flex-end;
  gap: 10px;
}

.hunt-card:fullscreen .hunt-actions button {
  width: 48px;
  height: 48px;
}

.hunt-card:fullscreen .hunt-actions svg {
  width: 22px;
  height: 22px;
}

.hunt-card:fullscreen .hunt-progress {
  width: min(100%, 900px);
  min-height: 0;
  justify-self: center;
  align-self: stretch;
  align-content: center;
  gap: clamp(20px, 5vh, 48px);
  padding: clamp(20px, 5vw, 56px);
  border: 0;
  border-radius: 0;
  background: transparent;
}

.hunt-card:fullscreen .counter {
  justify-content: center;
  gap: clamp(20px, 6vw, 80px);
}

.hunt-card:fullscreen .counter-button {
  width: clamp(56px, 8vw, 84px);
  height: clamp(56px, 8vw, 84px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  font-size: 2rem;
}

.hunt-card:fullscreen .fullscreen-count {
  min-height: 180px;
  user-select: none;
}

.hunt-card:fullscreen .counter-button.increment {
  width: clamp(72px, 10vw, 104px);
  height: clamp(72px, 10vw, 104px);
  font-size: 2.8rem;
}

.hunt-card:fullscreen .counter-value strong {
  font-size: clamp(4rem, 16vw, 11rem);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.hunt-card:fullscreen .counter-value span {
  margin-top: 8px;
  font-size: clamp(1rem, 2vw, 1.4rem);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.hunt-card:fullscreen .cumulative-chance {
  justify-content: center;
  gap: 12px;
  font-size: clamp(1rem, 2vw, 1.35rem);
}

.hunt-card:fullscreen .cumulative-chance strong {
  font-size: 1.3em;
}

.hunt-heading {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.hunt-title {
  min-width: 0;
}

.hunt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hunt-heading h3 {
  margin: 4px 0 0;
  font-size: clamp(1.25rem, 2vw, 1.55rem);
  line-height: 1.2;
  overflow-wrap: break-word;
  word-break: normal;
}

.remove-button {
  color: #ff9a9a;
}

.remove-button:hover {
  background: rgba(255, 71, 71, 0.12);
}

.complete-button,
.reopen-button,
.fullscreen-button {
  min-height: 34px;
  padding: 6px 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  font: inherit;
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
}

.fullscreen-button {
  padding: 7px;
}

.complete-button:hover,
.reopen-button:hover,
.fullscreen-button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.complete-button {
  color: #b7ee9b;
}

.reopen-button {
  color: #b7ee9b;
}

.hunt-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  min-width: 0;
  padding: 9px 11px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
}

.odds-editor {
  display: grid;
  gap: 8px;
}

.odds-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.odds-editor label {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.odds-editor label span {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.86rem;
  font-weight: 700;
}

.odds-editor input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #3b3b3b;
  border-radius: 10px;
  background: #101010;
  color: #fff;
  font: inherit;
}

.odds-editor input:focus-visible {
  outline: 2px solid #ffcf5c;
  outline-offset: 2px;
}

.visually-hidden-submit {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.odds-summary,
.started-date {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.odds-summary,
.cumulative-chance {
  margin: 0;
}

.cancel-button {
  padding: 0 12px;
  justify-self: end;
  min-height: 34px;
}

.cancel-button {
  background: #292929;
}

.cancel-button:hover {
  background: #3a3a3a;
}

.started-date {
  font-size: 0.88rem;
}

.hunt-progress {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
}

.counter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.counter.completed-counter {
  justify-content: center;
}

.counter-button {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #292929;
  font-size: 1.4rem;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.counter-button:hover:not(:disabled) {
  background: #3a3a3a;
}

.counter-button:disabled {
  color: #666;
  cursor: not-allowed;
}

.counter-button.increment {
  width: 64px;
  height: 64px;
  border-color: rgba(217, 67, 67, 0.7);
  background: #d94343;
  color: #fff;
  font-size: 2rem;
  box-shadow: 0 4px 16px rgba(217, 67, 67, 0.24);
}

.counter-button.increment:hover {
  background: #f05252;
  box-shadow: 0 6px 20px rgba(217, 67, 67, 0.36);
  transform: translateY(-2px) scale(1.04);
}

.counter-value {
  display: grid;
  min-width: 0;
  flex: 1;
  justify-items: center;
}

.counter-value strong {
  font-size: clamp(1.65rem, 4vw, 2rem);
  font-weight: 800;
  line-height: 1.1;
}

.counter-value span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.84rem;
  font-weight: 700;
}

.cumulative-chance {
  display: flex;
  align-items: baseline;
  /*justify-content: space-between;*/
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.88rem;
}

.cumulative-chance strong {
  color: #ffcf5c;
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

  .hunt-card:fullscreen {
    gap: 20px;
    padding: 20px;
  }

  .hunt-card:fullscreen .hunt-heading {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
  }

  .hunt-card:fullscreen .hunt-heading h3 {
    font-size: clamp(2rem, 12vw, 3.5rem);
  }

  .hunt-card:fullscreen .hunt-actions {
    gap: 4px;
  }

  .hunt-card:fullscreen .hunt-actions button {
    width: 40px;
    height: 40px;
  }

  .hunt-card:fullscreen .hunt-progress {
    gap: 24px;
    padding: 20px 12px;
    border-radius: 20px;
  }

  .hunt-card:fullscreen .counter {
    gap: 12px;
  }

  .hunt-card:fullscreen .counter-button {
    width: 48px;
    height: 48px;
    border-radius: 15px;
  }

  .hunt-card:fullscreen .counter-button.increment {
    width: 64px;
    height: 64px;
    font-size: 2rem;
  }

  .hunt-card:fullscreen .counter-value strong {
    font-size: clamp(3rem, 17vw, 6rem);
  }

}
</style>
