<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface Hunt {
  id: string
  target: string
  resets: number
  createdAt: string
  updatedAt?: string
  dailyResets?: Record<string, number>
  odds?: number
  completed?: boolean
  completedAt?: string
}

const STORAGE_KEY = 'pokedex-hunts'
const DEFAULT_ODDS = 4096
const getLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const hunts = ref<Hunt[]>([])
const todayKey = ref(getLocalDateKey(new Date()))
const target = ref('')
const error = ref('')
const editingHuntId = ref<string | null>(null)
const oddsDraft = ref({ target: '', odds: '', resets: '', startDate: '' })
const fullscreenHuntId = ref<string | null>(null)
const pipHuntId = ref<string | null>(null)
const pipWindow = ref<Window | null>(null)
const pipCard = ref<HTMLElement | null>(null)
const pipPlaceholder = ref<Comment | null>(null)
const screenWakeLock = ref<WakeLockSentinel | null>(null)
let wakeLockRequestId = 0
let dateRefreshTimer: ReturnType<typeof setInterval> | undefined

type DocumentPictureInPictureApi = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
}

const totalResets = computed(() => hunts.value.reduce((total, hunt) => total + hunt.resets, 0))
const getAverageEncountersPerDay = (hunt: Hunt) => {
  const startedAt = new Date(hunt.createdAt)
  if (Number.isNaN(startedAt.getTime())) return 0

  const endDate = hunt.completed && hunt.completedAt
    ? new Date(hunt.completedAt)
    : new Date(`${todayKey.value}T00:00:00`)
  if (Number.isNaN(endDate.getTime())) return 0

  const startDay = Date.UTC(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate())
  const endDay = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  const activeDays = Math.max(1, Math.floor((endDay - startDay) / 86_400_000) + 1)
  return hunt.resets / activeDays
}
const sortedHunts = computed(() =>
  [...hunts.value].sort((a, b) => {
    if (Boolean(a.completed) !== Boolean(b.completed)) {
      return Number(Boolean(a.completed)) - Number(Boolean(b.completed))
    }

    return Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt)
  }),
)

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
  && (!('updatedAt' in value) || typeof value.updatedAt === 'string')
  && (!('dailyResets' in value)
    || (typeof value.dailyResets === 'object'
      && value.dailyResets !== null
      && !Array.isArray(value.dailyResets)
      && Object.entries(value.dailyResets).every(([date, count]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date)
        && typeof count === 'number'
        && Number.isSafeInteger(count)
        && count >= 0)))
  && (!('odds' in value)
    || (typeof value.odds === 'number' && Number.isSafeInteger(value.odds) && value.odds > 0))
  && (!('completed' in value) || typeof value.completed === 'boolean')
  && (!('completedAt' in value) || typeof value.completedAt === 'string')

const saveHunts = (updatedHunts: Hunt[]) => {
  const timestamp = new Date().toISOString()
  const huntsWithUpdateTimes = updatedHunts.map((hunt) => {
    const previous = hunts.value.find((current) => current.id === hunt.id)
    if (!previous) {
      return { ...hunt, updatedAt: hunt.updatedAt ?? hunt.createdAt }
    }

    const changed = hunt.target !== previous.target
      || hunt.resets !== previous.resets
      || JSON.stringify(hunt.dailyResets ?? {}) !== JSON.stringify(previous.dailyResets ?? {})
      || hunt.odds !== previous.odds
      || hunt.completed !== previous.completed
      || hunt.completedAt !== previous.completedAt

    return changed ? { ...hunt, updatedAt: timestamp } : hunt
  })

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(huntsWithUpdateTimes))
    hunts.value = huntsWithUpdateTimes
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
    dailyResets: {},
    odds: DEFAULT_ODDS,
  }

  if (saveHunts([newHunt, ...hunts.value])) {
    target.value = ''
  }
}

const changeResets = (hunt: Hunt, amount: number) => {
  const updatedHunts = hunts.value.map((current) =>
    {
      if (current.id !== hunt.id) return current

      const dailyResets = { ...current.dailyResets }
      const todayCount = dailyResets[todayKey.value] ?? 0
      const nextTodayCount = amount > 0 ? todayCount + amount : Math.max(0, todayCount + amount)
      if (nextTodayCount > 0) {
        dailyResets[todayKey.value] = nextTodayCount
      } else {
        delete dailyResets[todayKey.value]
      }

      return {
        ...current,
        resets: Math.max(0, current.resets + amount),
        dailyResets,
      }
    },
  )
  saveHunts(updatedHunts)
}

const editOdds = (hunt: Hunt) => {
  editingHuntId.value = hunt.id
  oddsDraft.value = {
    target: hunt.target,
    odds: String(hunt.odds ?? DEFAULT_ODDS),
    resets: String(hunt.resets),
    startDate: getLocalDateKey(new Date(hunt.createdAt)),
  }
  error.value = ''
}

const cancelOddsEdit = () => {
  editingHuntId.value = null
  oddsDraft.value = { target: '', odds: '', resets: '', startDate: '' }
}

const saveHuntEdit = (hunt: Hunt) => {
  const huntTarget = oddsDraft.value.target.trim()
  const oddsInput = String(oddsDraft.value.odds).trim()
  const resetsInput = String(oddsDraft.value.resets).trim()
  const startDateInput = oddsDraft.value.startDate
  const odds = Number(oddsInput)
  const resets = Number(resetsInput)
  if (!huntTarget) {
    error.value = 'Hunt name cannot be empty.'
    return
  }
  if (huntTarget.length > 80) {
    error.value = 'Hunt name must be 80 characters or fewer.'
    return
  }
  if (!oddsInput || !Number.isSafeInteger(odds) || odds < 1) {
    error.value = 'Odds must be a whole number greater than 0.'
    return
  }
  if (!resetsInput || !Number.isSafeInteger(resets) || resets < 0) {
    error.value = 'Encounters must be a whole number greater than or equal to 0.'
    return
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateInput)) {
    error.value = 'Enter a valid hunt start date.'
    return
  }
  const dateParts = startDateInput.split('-')
  const year = Number(dateParts[0])
  const month = Number(dateParts[1])
  const day = Number(dateParts[2])
  const startDate = new Date(year, month - 1, day, 12)
  if (getLocalDateKey(startDate) !== startDateInput) {
    error.value = 'Enter a valid hunt start date.'
    return
  }
  if (startDateInput > todayKey.value) {
    error.value = 'Hunt start date cannot be in the future.'
    return
  }

  const updatedHunts = hunts.value.map((current) =>
    current.id === hunt.id
      ? { ...current, target: huntTarget, odds, resets, createdAt: startDate.toISOString() }
      : current,
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

const syncScreenWakeLock = async () => {
  const requestId = ++wakeLockRequestId
  if (!fullscreenHuntId.value) {
    const activeWakeLock = screenWakeLock.value
    screenWakeLock.value = null
    if (activeWakeLock && !activeWakeLock.released) {
      try {
        await activeWakeLock.release()
      } catch (err) {
        error.value = `Unable to release the screen wake lock: ${err instanceof Error ? err.message : String(err)}`
      }
    }
    return
  }

  if (document.visibilityState !== 'visible' || screenWakeLock.value) return

  if (!('wakeLock' in navigator)) {
    error.value = 'Keeping the screen awake is not supported by this browser.'
    return
  }

  try {
    const wakeLock = await navigator.wakeLock.request('screen')
    if (requestId !== wakeLockRequestId || !fullscreenHuntId.value || document.visibilityState !== 'visible') {
      await wakeLock.release()
      return
    }

    screenWakeLock.value = wakeLock
    wakeLock.addEventListener('release', () => {
      if (screenWakeLock.value === wakeLock) screenWakeLock.value = null
      if (fullscreenHuntId.value && document.visibilityState === 'visible') {
        void syncScreenWakeLock()
      }
    }, { once: true })
  } catch (err) {
    if (requestId === wakeLockRequestId && fullscreenHuntId.value) {
      error.value = `Unable to keep the screen awake: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

const handleFullscreenKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !fullscreenHuntId.value) return

  fullscreenHuntId.value = null
  void syncScreenWakeLock()
}

const toggleFullscreen = (event: MouseEvent) => {
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

  error.value = ''
  const huntId = card.dataset.huntId
  if (!huntId) {
    error.value = 'Unable to find the hunt to display fullscreen.'
    return
  }

  fullscreenHuntId.value = fullscreenHuntId.value === huntId ? null : huntId
  void syncScreenWakeLock()
}

const handleHuntCardClick = (hunt: Hunt, event: MouseEvent) => {
  if (fullscreenHuntId.value !== hunt.id && pipHuntId.value !== hunt.id) return

  const target = event.target
  if (target instanceof Element && target.closest('.fullscreen-button, .pip-exit-button')) return

  changeResets(hunt, 1)
}

const restorePipCard = (closeWindow = false) => {
  if (pipCard.value && pipPlaceholder.value?.isConnected) {
    pipCard.value.classList.remove('pip-active')
    pipPlaceholder.value.replaceWith(pipCard.value)
  }

  const activePipWindow = pipWindow.value
  pipCard.value = null
  pipPlaceholder.value = null
  pipWindow.value = null
  pipHuntId.value = null

  if (closeWindow && activePipWindow && !activePipWindow.closed) {
    activePipWindow.close()
  }
}

const openPictureInPicture = async (event: MouseEvent, hunt: Hunt) => {
  const api = (window as Window & {
    documentPictureInPicture?: DocumentPictureInPictureApi
  }).documentPictureInPicture

  if (!api) {
    error.value = 'Picture-in-Picture is not supported by this browser.'
    return
  }
  
  const button = event.currentTarget
  if (!(button instanceof HTMLElement)) {
    error.value = 'Unable to find the hunt card to pop out.'
    return
  }
  const card = button.closest<HTMLElement>('.hunt-card')
  if (!card || !card.parentNode) {
    error.value = 'Unable to find the hunt card to pop out.'
    return
  }

  try {
    const pip = await api.requestWindow({ width: 420, height: 360 })
    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((stylesheet) => {
      pip.document.head.append(stylesheet.cloneNode(true))
    })

    pip.document.documentElement.style.height = '100%'
    pip.document.body.style.cssText = 'height:100%;margin:0;overflow:hidden;background:#000;'
    const placeholder = document.createComment('hunt-picture-in-picture')
    card.parentNode.insertBefore(placeholder, card)
    card.classList.add('pip-active')
    pip.document.body.append(card)

    pipWindow.value = pip
    pipCard.value = card
    pipPlaceholder.value = placeholder
    pipHuntId.value = hunt.id
    error.value = ''
    pip.addEventListener('pagehide', () => restorePipCard(), { once: true })
  } catch (err) {
    error.value = `Unable to open Picture-in-Picture: ${err instanceof Error ? err.message : String(err)}`
  }
}

const closePictureInPicture = () => restorePipCard(true)

const removeHunt = (hunt: Hunt) => {
  if (!window.confirm(`Remove the ${hunt.target} hunt and its reset count?`)) return
  saveHunts(hunts.value.filter((current) => current.id !== hunt.id))
}

onMounted(() => {
  document.addEventListener('visibilitychange', syncScreenWakeLock)
  document.addEventListener('keydown', handleFullscreenKeydown)
  dateRefreshTimer = setInterval(() => {
    todayKey.value = getLocalDateKey(new Date())
  }, 60_000)

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
  if (dateRefreshTimer) clearInterval(dateRefreshTimer)
  document.removeEventListener('visibilitychange', syncScreenWakeLock)
  document.removeEventListener('keydown', handleFullscreenKeydown)
  fullscreenHuntId.value = null
  restorePipCard(true)
  void syncScreenWakeLock()
})
</script>

<template>
  <section class="hunts-view">
    <header class="hunts-hero">
      <div>
        <p class="eyebrow">Hunt tracker</p>
        <h2>Every reset brings you closer</h2>
      </div>
    </header>

    <p v-if="error" class="status error" role="alert">{{ error }}</p>

    <form class="add-hunt panel" @submit.prevent="addHunt">
      <div class="add-controls">
        <input
          id="hunt-target"
          v-model="target"
          type="text"
          maxlength="80"
          placeholder="What are we hunting?"
          autocomplete="off"
          required
        >
        <button type="submit" class="primary-button">Add hunt</button>
      </div>
    </form>

    <div v-if="hunts.length" class="hunt-grid">
      <article
        v-for="hunt in sortedHunts"
        :key="hunt.id"
        class="hunt-card"
        :class="{ completed: hunt.completed, 'fullscreen-mode': fullscreenHuntId === hunt.id }"
        :data-hunt-id="hunt.id"
        @click="handleHuntCardClick(hunt, $event)"
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
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id && pipHuntId !== hunt.id"
              type="button"
              class="popout-button"
              :aria-label="`Open ${hunt.target} hunt in Picture-in-Picture`"
              title="Pop out hunt"
              @click.stop="openPictureInPicture($event, hunt)"
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
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M13 12h6v5h-6z" />
              </svg>
            </button>
            <button
              v-if="pipHuntId === hunt.id"
              type="button"
              class="pip-exit-button"
              :aria-label="`Close ${hunt.target} Picture-in-Picture window`"
              title="Close pop-out"
              @click.stop="closePictureInPicture"
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
                <path d="m18 6-12 12M6 6l12 12" />
              </svg>
            </button>
            <button
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id && pipHuntId !== hunt.id"
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
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id && pipHuntId !== hunt.id"
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
            <label class="hunt-name-field" :for="`target-${hunt.id}`">
              <span>Hunt name</span>
              <input
                :id="`target-${hunt.id}`"
                v-model="oddsDraft.target"
                type="text"
                maxlength="80"
                autocomplete="off"
                required
              >
            </label>
            <label class="hunt-start-date-field" :for="`start-date-${hunt.id}`">
              <span>Start date</span>
              <input
                :id="`start-date-${hunt.id}`"
                v-model="oddsDraft.startDate"
                type="date"
                :max="todayKey"
                required
              >
            </label>
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
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id && pipHuntId !== hunt.id"
              type="button"
              class="counter-button"
              :aria-label="`Decrease ${hunt.target} reset count`"
              :disabled="hunt.resets === 0"
              @click="changeResets(hunt, -1)"
            >
              −
            </button>
            <div
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id && pipHuntId !== hunt.id"
              class="counter-value"
            >
              <strong>{{ hunt.resets.toLocaleString() }}</strong>
              <span>encounters</span>
            </div>
            <div
              v-else
              class="counter-value"
              :class="{ 'fullscreen-count': fullscreenHuntId === hunt.id, 'pip-count': pipHuntId === hunt.id }"
              :role="fullscreenHuntId === hunt.id || pipHuntId === hunt.id ? 'button' : undefined"
              :tabindex="fullscreenHuntId === hunt.id || pipHuntId === hunt.id ? 0 : undefined"
              :aria-label="fullscreenHuntId === hunt.id || pipHuntId === hunt.id ? `Add one encounter to ${hunt.target}` : undefined"
              aria-live="polite"
              @keydown.enter.prevent="(fullscreenHuntId === hunt.id || pipHuntId === hunt.id) && changeResets(hunt, 1)"
              @keydown.space.prevent="(fullscreenHuntId === hunt.id || pipHuntId === hunt.id) && changeResets(hunt, 1)"
            >
              <strong>{{ hunt.resets.toLocaleString() }}</strong>
              <span>encounters</span>
            </div>
            <button
              v-if="!hunt.completed && fullscreenHuntId !== hunt.id && pipHuntId !== hunt.id"
              type="button"
              class="counter-button increment"
              :aria-label="`Add a reset to ${hunt.target}`"
              @click="changeResets(hunt, 1)"
            >
              <span class="increment-glyph" aria-hidden="true">+</span>
            </button>
          </div>
          <p v-if="!hunt.completed" class="cumulative-chance">
            Cumulative chance <strong>{{ cumulativeChance(hunt).toLocaleString(undefined, { maximumFractionDigits: 2 }) }}%</strong>
          </p>
          <div v-if="fullscreenHuntId === hunt.id" class="fullscreen-daily-stats">
            <div>
              <span>Encounters today</span>
              <strong>{{ (hunt.dailyResets?.[todayKey] ?? 0).toLocaleString() }}</strong>
            </div>
            <div>
              <span>Average per day</span>
              <strong>{{ getAverageEncountersPerDay(hunt).toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</strong>
            </div>
          </div>
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

.add-hunt {
  padding: 12px 16px;
}

.add-hunt label {
  display: block;
  margin-bottom: 4px;
  font-weight: 700;
}

.add-controls {
  display: flex;
  gap: 10px;
}

.add-controls input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
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
.popout-button,
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
.popout-button,
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
.popout-button,
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
.popout-button svg,
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

.popout-button {
  color: #b7d8ff;
}

.popout-button:hover {
  background: rgba(122, 175, 255, 0.12);
}

.primary-button {
  min-height: 40px;
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

.hunt-card:fullscreen,
.hunt-card.fullscreen-mode {
  position: fixed;
  inset: 0;
  z-index: 9999;
  box-sizing: border-box;
  display: grid;
  width: auto;
  min-width: 0;
  min-height: 0;
  height: auto;
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

.hunt-card:fullscreen,
.hunt-card.fullscreen-mode,
.hunt-card:fullscreen *,
.hunt-card.fullscreen-mode * {
  -webkit-tap-highlight-color: transparent;
}

.hunt-card:fullscreen .hunt-heading,
.hunt-card.fullscreen-mode .hunt-heading {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
}

.hunt-card:fullscreen .hunt-heading h3,
.hunt-card.fullscreen-mode .hunt-heading h3 {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 6rem);
  letter-spacing: -0.04em;
  line-height: 1;
}

.hunt-card:fullscreen .hunt-actions,
.hunt-card.fullscreen-mode .hunt-actions {
  justify-content: flex-end;
  gap: 10px;
}

.hunt-card:fullscreen .hunt-actions button,
.hunt-card.fullscreen-mode .hunt-actions button {
  width: 48px;
  height: 48px;
}

.hunt-card:fullscreen .hunt-actions svg,
.hunt-card.fullscreen-mode .hunt-actions svg {
  width: 22px;
  height: 22px;
}

.hunt-card:fullscreen .hunt-progress,
.hunt-card.fullscreen-mode .hunt-progress {
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

.hunt-card:fullscreen .counter,
.hunt-card.fullscreen-mode .counter {
  justify-content: center;
  gap: clamp(20px, 6vw, 80px);
}

.hunt-card:fullscreen .counter-button,
.hunt-card.fullscreen-mode .counter-button {
  width: clamp(56px, 8vw, 84px);
  height: clamp(56px, 8vw, 84px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  font-size: 2rem;
}

.hunt-card:fullscreen .fullscreen-count,
.hunt-card.fullscreen-mode .fullscreen-count {
  min-height: 180px;
  user-select: none;
}

.hunt-card:fullscreen .counter-button.increment,
.hunt-card.fullscreen-mode .counter-button.increment {
  width: clamp(72px, 10vw, 104px);
  height: clamp(72px, 10vw, 104px);
  font-size: 2.8rem;
}

.hunt-card:fullscreen .counter-value strong,
.hunt-card.fullscreen-mode .counter-value strong {
  max-width: 100%;
  font-size: clamp(2rem, min(27vw, 42vh), 12rem);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hunt-card:fullscreen .counter-value span,
.hunt-card.fullscreen-mode .counter-value span {
  margin-top: 8px;
  font-size: clamp(1rem, 2vw, 1.4rem);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.hunt-card:fullscreen .cumulative-chance,
.hunt-card.fullscreen-mode .cumulative-chance {
  justify-content: center;
  gap: 12px;
  font-size: clamp(1rem, 2vw, 1.35rem);
}

.hunt-card:fullscreen .cumulative-chance strong,
.hunt-card.fullscreen-mode .cumulative-chance strong {
  font-size: 1.3em;
}

.fullscreen-daily-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  width: min(100%, 620px);
  justify-self: center;
  text-align: center;
}

.fullscreen-daily-stats div {
  display: grid;
  gap: 6px;
}

.fullscreen-daily-stats span {
  color: rgba(255, 255, 255, 0.65);
  font-size: clamp(0.8rem, 1.8vw, 1rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fullscreen-daily-stats strong {
  color: #ffcf5c;
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  font-variant-numeric: tabular-nums;
}

.hunt-card.pip-active {
  box-sizing: border-box;
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 100%;
  grid-template-rows: auto 1fr;
  gap: 18px;
  padding: 18px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: #000;
  color: #fff;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.hunt-card.pip-active .hunt-heading {
  position: relative;
  grid-template-columns: 1fr;
  align-items: center;
  padding-right: 42px;
}

.hunt-card.pip-active .hunt-heading h3 {
  margin: 0;
  font-size: clamp(1.35rem, 8vw, 2rem);
  text-align: center;
}

.hunt-card.pip-active .hunt-actions {
  position: absolute;
  top: 0;
  right: 0;
}

.hunt-card.pip-active .hunt-actions > :not(.pip-exit-button),
.hunt-card.pip-active .hunt-details,
.hunt-card.pip-active .odds-editor,
.hunt-card.pip-active .counter-button {
  display: none;
}

.hunt-card.pip-active .pip-exit-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  padding: 8px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
}

.hunt-card.pip-active .pip-exit-button svg {
  width: 18px;
  height: 18px;
}

.hunt-card.pip-active .hunt-progress {
  width: 100%;
  min-height: 0;
  align-content: center;
  gap: 18px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.hunt-card.pip-active .counter {
  justify-content: center;
}

.hunt-card.pip-active .pip-count {
  min-height: 0;
  cursor: pointer;
}

.hunt-card.pip-active .counter-value strong {
  font-size: clamp(3rem, 22vw, 6rem);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.hunt-card.pip-active .counter-value span {
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hunt-card.pip-active .cumulative-chance {
  justify-content: center;
  font-size: 1rem;
}

.hunt-card.pip-active .cumulative-chance strong {
  font-size: 1.2em;
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

.hunt-name-field {
  grid-column: 1 / -1;
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
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: #292929;
  font-size: 1.4rem;
  line-height: 1;
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

.increment-glyph {
  display: block;
  font-size: 2.2rem;
  font-weight: 900;
  line-height: 1;
  transform: translateY(-2px);
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
    align-items: stretch;
  }

  .primary-button {
    padding: 0 12px;
    white-space: nowrap;
  }

  .hunt-card:fullscreen,
  .hunt-card.fullscreen-mode {
    gap: 20px;
    padding: 20px;
  }

  .hunt-card:fullscreen .hunt-heading,
  .hunt-card.fullscreen-mode .hunt-heading {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
  }

  .hunt-card:fullscreen .hunt-heading h3,
  .hunt-card.fullscreen-mode .hunt-heading h3 {
    font-size: clamp(1.35rem, 7vw, 2.25rem);
  }

  .hunt-card:fullscreen .hunt-actions,
  .hunt-card.fullscreen-mode .hunt-actions {
    gap: 4px;
  }

  .hunt-card:fullscreen .hunt-actions button,
  .hunt-card.fullscreen-mode .hunt-actions button {
    width: 40px;
    height: 40px;
  }

  .hunt-card:fullscreen .hunt-progress,
  .hunt-card.fullscreen-mode .hunt-progress {
    gap: 24px;
    padding: 20px 12px;
    border-radius: 20px;
  }

  .hunt-card:fullscreen .counter,
  .hunt-card.fullscreen-mode .counter {
    gap: 12px;
  }

  .hunt-card:fullscreen .counter-button,
  .hunt-card.fullscreen-mode .counter-button {
    width: 48px;
    height: 48px;
    border-radius: 15px;
  }

  .hunt-card:fullscreen .counter-button.increment,
  .hunt-card.fullscreen-mode .counter-button.increment {
    width: 64px;
    height: 64px;
    font-size: 2rem;
  }

}

@media (max-width: 360px) {
  .add-controls {
    flex-direction: column;
  }

  .primary-button {
    min-height: 40px;
    padding: 0 12px;
  }
}

@media (max-height: 480px), (max-width: 320px) {
  .hunt-card:fullscreen,
  .hunt-card.fullscreen-mode {
    inset: 0;
    grid-template-rows: 1fr;
    gap: 0;
    padding: 8px;
    overflow: hidden;
  }

  .hunt-card:fullscreen .hunt-heading,
  .hunt-card.fullscreen-mode .hunt-heading,
  .hunt-card:fullscreen .counter-value span,
  .hunt-card.fullscreen-mode .counter-value span,
  .hunt-card:fullscreen .cumulative-chance,
  .hunt-card.fullscreen-mode .cumulative-chance,
  .hunt-card:fullscreen .fullscreen-daily-stats,
  .hunt-card.fullscreen-mode .fullscreen-daily-stats {
    display: none;
  }

  .hunt-card:fullscreen .hunt-progress,
  .hunt-card.fullscreen-mode .hunt-progress {
    width: 100%;
    padding: 0;
  }

  .hunt-card:fullscreen .fullscreen-count,
  .hunt-card.fullscreen-mode .fullscreen-count {
    min-height: 0;
  }

  .hunt-card:fullscreen .counter,
  .hunt-card.fullscreen-mode .counter {
    gap: 0;
  }
}

</style>
