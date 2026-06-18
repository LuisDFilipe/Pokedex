<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { defaultCollectionFilters, loadPokedex, readCollections, writeCollections } from '@/lib/pokedex'
import type { NamedCollection, PokemonEntry, PokemonForm } from '@/types/pokedex'

const GAME_COLLECTION_NAME = 'Game Colletion'
const GAME_COLLECTION_ID = 'game-colletion'
const HOURLY_ENCOUNTER_POOL_SIZE = 50
const ENCOUNTER_DELAY = 1
const SHINY_ODDS = 5 //Percentage

const pokemonList = ref<PokemonEntry[]>([])
const allCollections = ref<NamedCollection[]>([])
const currentPokemon = ref<PokemonEntry | null>(null)
const currentForm = ref<PokemonForm | null>(null)
const currentIsShiny = ref(false)
const loading = ref(true)
const error = ref('')
const saveMessage = ref('')
const isEncounterCooldown = ref(false)
const cooldownRemaining = ref(0)

const normalSprites = import.meta.glob('../../sprites/pokemon/normal/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const shinySprites = import.meta.glob('../../sprites/pokemon/shiny/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const createSpriteMap = (sprites: Record<string, string>) => Object.fromEntries(
  Object.entries(sprites).map(([path, url]) => {
    const fileName = path.split('/').pop() ?? ''
    const id = fileName.replace('.png', '')
    return [id, url]
  }),
) as Record<string, string>

const normalSpriteMap = createSpriteMap(normalSprites)
const shinySpriteMap = createSpriteMap(shinySprites)

const encounterForms = computed(() =>
  [...pokemonList.value]
    .flatMap((pokemon) =>
      pokemon.forms.map((form) => ({
        pokemon,
        form,
      })),
    )
    .sort(() => random() - 0.5)
    .slice(0, HOURLY_ENCOUNTER_POOL_SIZE)
)

const padDatePart = (value: number) => String(value).padStart(2, '0')

const getHourKey = (date = new Date()) =>
  [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
    padDatePart(date.getHours()),
    //padDatePart(date.getMinutes()),
  ].join('-')

const hashString = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createSeededRandom = (seed: string) => {
  let state = hashString(seed) || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const random = createSeededRandom(`${getHourKey()}`)

const gameCollection = computed(() =>
  allCollections.value.find((collection) => collection.name === GAME_COLLECTION_NAME)
  ?? allCollections.value.find((collection) => collection.id === GAME_COLLECTION_ID)
  ?? null,
)

const isCaught = computed(() => {
  if (!currentForm.value || !gameCollection.value) return false
  const collectionList = currentIsShiny.value ? gameCollection.value.state.shiny : gameCollection.value.state.normal
  return collectionList.includes(currentForm.value.id)
})

const getSpriteUrl = (form: PokemonForm, isShiny: boolean) => {
  const preferredSpriteMap = isShiny ? shinySpriteMap : normalSpriteMap
  const fallbackSpriteMap = isShiny ? normalSpriteMap : shinySpriteMap
  const spriteKey = form.sprite?.replace('.png', '')

  return preferredSpriteMap[form.id]
    ?? (spriteKey ? preferredSpriteMap[spriteKey] : undefined)
    ?? fallbackSpriteMap[form.id]
    ?? (spriteKey ? fallbackSpriteMap[spriteKey] : undefined)
    ?? ''
}

const currentSprite = computed(() => {
  if (!currentForm.value) return ''
  return getSpriteUrl(currentForm.value, currentIsShiny.value)
})

const currentNumber = computed(() => currentForm.value?.id ?? currentPokemon.value?.id ?? '')

const currentDisplayName = computed(() => {
  if (!currentPokemon.value || !currentForm.value) return ''
  if (currentForm.value.name && currentForm.value.name !== currentPokemon.value.name) {
    return currentForm.value.name
  }
  return currentPokemon.value.name
})

const uncaughtEncounterForms = computed(() => {
  const caughtNormalIds = new Set(gameCollection.value?.state.normal ?? [])
  const uncaughtNormalForms = encounterForms.value
    .filter(({ form }) => !caughtNormalIds.has(form.id))
    .slice()
    .sort((a, b) => a.form.id.localeCompare(b.form.id, undefined, { numeric: true }))

  if (uncaughtNormalForms.length > 0) {
    return uncaughtNormalForms.map((entry) => ({ ...entry, isShiny: false }))
  }

  const caughtShinyIds = new Set(gameCollection.value?.state.shiny ?? [])
  return encounterForms.value
    .filter(({ form }) => !caughtShinyIds.has(form.id))
    .slice()
    .sort((a, b) => a.form.id.localeCompare(b.form.id, undefined, { numeric: true }))
    .map((entry) => ({ ...entry, isShiny: true }))
})

const isShowingOnlyShinies = computed(() =>
  uncaughtEncounterForms.value.length > 0 && uncaughtEncounterForms.value.every((entry) => entry.isShiny)
)

const totalPossible = computed(() => encounterForms.value.length)

const caughtNormalCount = computed(() => {
  if (!gameCollection.value) return 0
  const possibleIds = new Set(encounterForms.value.map((f) => f.form.id))
  
  return gameCollection.value.state.normal.filter((id) => possibleIds.has(id)).length
})

const caughtShinyCount = computed(() => {
  if (!gameCollection.value) return 0
  const possibleIds = new Set(encounterForms.value.map((f) => f.form.id))
  return gameCollection.value.state.shiny.filter((id) => possibleIds.has(id)).length
})

const totalCaughtInRange = computed(() => caughtNormalCount.value + caughtShinyCount.value)
const totalPossibleInRange = computed(() => totalPossible.value * 2) // Normal + Shiny

const ensureGameCollection = () => {
  const existing = gameCollection.value
  if (existing) {
    if (existing.name !== GAME_COLLECTION_NAME) {
      existing.name = GAME_COLLECTION_NAME
    }
    writeCollections(allCollections.value)
    return existing
  }

  const collection: NamedCollection = {
    id: GAME_COLLECTION_ID,
    name: GAME_COLLECTION_NAME,
    state: { normal: [], shiny: [], tags: {} },
    filters: { ...defaultCollectionFilters },
  }

  allCollections.value = [...allCollections.value, collection]
  writeCollections(allCollections.value)
  return collection
}

const encounterPokemon = () => {
  if (isEncounterCooldown.value) return
  isEncounterCooldown.value = true
  cooldownRemaining.value = ENCOUNTER_DELAY

  saveMessage.value = ''
  if (!encounterForms.value.length) {
    isEncounterCooldown.value = false
    cooldownRemaining.value = 0
    return
  }

  const encounter = encounterForms.value[Math.floor(Math.random() * encounterForms.value.length)]
  if (!encounter) {
    isEncounterCooldown.value = false
    cooldownRemaining.value = 0
    return
  }

  currentPokemon.value = encounter.pokemon
  currentForm.value = encounter.form
  currentIsShiny.value = Math.random() < (SHINY_ODDS / 100)

  const timer = setInterval(() => {
    cooldownRemaining.value -= 1
    if (cooldownRemaining.value <= 0) {
      clearInterval(timer)
      isEncounterCooldown.value = false
    }
  }, 1000)
}

const savePokemon = () => {
  if (!currentForm.value) return

  const collection = ensureGameCollection()
  const collectionList = currentIsShiny.value ? collection.state.shiny : collection.state.normal

  if (collectionList.includes(currentForm.value.id)) {
    saveMessage.value = 'Already saved in Game Colletion.'
    return
  }

  if (currentIsShiny.value) {
    collection.state.shiny = [...collection.state.shiny, currentForm.value.id]
  } else {
    collection.state.normal = [...collection.state.normal, currentForm.value.id]
  }

  writeCollections(allCollections.value)
  saveMessage.value = 'Saved to Game Colletion.'
}

onMounted(async () => {
  try {
    allCollections.value = readCollections()
    ensureGameCollection()
    pokemonList.value = await loadPokedex()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load the game.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="game-v2">
    <div class="game-panel">
      <div class="game-actions">
        <button class="encounter-btn" type="button" :disabled="loading || isEncounterCooldown || (currentIsShiny && !isCaught)" @click="encounterPokemon">
          {{ isEncounterCooldown ? `Wait ${cooldownRemaining}s` : 'Encounter Pokémon' }}
        </button>
      </div>

      <p v-if="loading" class="status-text">Loading Pokemon...</p>
      <p v-else-if="error" class="status-text error">{{ error }}</p>

      <article v-else-if="currentPokemon && currentForm" class="pokemon-encounter">
        <div class="sprite-stage" :class="{ caught: isCaught, shiny: currentIsShiny }">
          <p class="pokemon-number">{{ currentNumber }}</p>
          <img v-if="currentSprite" :src="currentSprite" :alt="currentDisplayName" />
          <span v-else class="sprite-missing">?</span>
        </div>

        <div class="pokemon-info">
          <h2>{{ currentDisplayName }}</h2>
          <p class="caught-state">{{ isCaught ? 'Already caught' : 'Not caught yet' }}</p>
        </div>

        <button class="save-btn" type="button" :disabled="isCaught" @click="savePokemon">
          {{ isCaught ? 'Caught' : 'Catch Pokémon' }}
        </button>

        <p v-if="saveMessage" class="save-message">{{ saveMessage }}</p>
      </article>

      <p v-else class="status-text">Press the button to find a Pokemon.</p>

      <div class="game-stats">
        <div class="stat-row">
          <span>Normal Caught</span>
          <strong>{{ caughtNormalCount }} / {{ totalPossible }}</strong>
        </div>
        <div class="stat-row">
          <span class="shiny-label">Shiny Caught</span>
          <strong>{{ caughtShinyCount }} / {{ totalPossible }}</strong>
        </div>
        
        <div class="collection-summary">
          <span>Total Progress</span>
          <strong>{{ totalCaughtInRange }} / {{ totalPossibleInRange }}</strong>
        </div>
      </div>

      <div v-if="!loading && !error" class="catchable-list">
        <h3>
          Catchable
          <span v-if="isShowingOnlyShinies" class="catchable-title-shiny">Shiny</span>
          Pokemon
        </h3>
        <ul>
          <li v-for="{ pokemon, form, isShiny } in uncaughtEncounterForms" :key="`${form.id}-${isShiny ? 'shiny' : 'normal'}`">
            <img v-if="getSpriteUrl(form, isShiny)" :src="getSpriteUrl(form, isShiny)" :alt="form.name || pokemon.name" />
            <span v-else class="catchable-missing">?</span>
            <span class="catchable-details">
              <span class="catchable-number">{{ form.id }}</span>
              <span class="catchable-name">
                {{ form.name && form.name !== pokemon.name ? form.name : pokemon.name }}
                <!-- <span v-if="isShiny" class="catchable-shiny">Shiny</span> -->
              </span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.game-v2 {
  display: grid;
  place-items: start center;
  min-height: 52vh;
  padding: 12px;
}

.game-panel {
  width: min(460px, 100%);
  display: grid;
  gap: 18px;
  justify-items: center;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(18, 18, 18, 0.84);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
}

.game-stats {
  width: 100%;
  display: grid;
  gap: 12px;
}

.game-actions {
  width: 100%;
}

.encounter-btn,
.save-btn {
  width: 100%;
  min-height: 46px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, opacity 0.18s ease;
}

.encounter-btn {
  background: #ff4747;
}

.save-btn {
  background: #2f7d4f;
}

.encounter-btn:hover,
.save-btn:hover {
  transform: translateY(-1px);
}

.encounter-btn:disabled,
.save-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.pokemon-encounter {
  width: 100%;
  display: grid;
  gap: 14px;
  justify-items: center;
  text-align: center;
}

.sprite-stage {
  width: min(260px, 100%);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    #171717;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.sprite-stage.caught {
  border-color: rgba(47, 125, 79, 0.9);
  box-shadow: 0 0 0 3px rgba(47, 125, 79, 0.18);
}

.sprite-stage.shiny {
  border-color: rgba(247, 208, 44, 0.92);
  box-shadow: 0 0 0 3px rgba(247, 208, 44, 0.18), 0 18px 42px rgba(247, 208, 44, 0.12);
}

.sprite-stage img {
  width: 78%;
  height: 78%;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.45));
}

.sprite-missing {
  color: #777;
  font-size: 4rem;
  font-weight: 900;
}

.pokemon-info {
  display: grid;
  gap: 4px;
}

.pokemon-info h2,
.pokemon-info p {
  margin: 0;
}

.pokemon-info h2 {
  font-size: 2rem;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.pokemon-number {
  color: #bdbdbd;
  font-weight: 800;
}

.form-label {
  color: #bdbdbd;
  font-weight: 700;
}

.shiny-label {
  color: #f7d02c;
  font-weight: 900;
}

.caught-state {
  color: #e8e8e8;
}

.status-text,
.save-message {
  margin: 0;
  color: #bdbdbd;
  text-align: center;
}

.status-text.error {
  color: #ffb3b3;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #a6a6a6;
}

.collection-summary {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #cfcfcf;
}

.collection-summary strong {
  color: #fff;
  font-size: 1.2rem;
}

.catchable-list {
  width: 100%;
  display: grid;
  gap: 10px;
}

.catchable-list h3 {
  margin: 0;
  color: #fff;
  font-size: 1rem;
  line-height: 1.2;
}

.catchable-title-shiny {
  color: #f7d02c;
}

.catchable-list ul {
  width: 100%;
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.catchable-list li {
  display: grid;
  grid-template-columns: 54px 1fr;
  align-items: center;
  gap: 10px;
  min-height: 60px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #e8e8e8;
  font-size: 0.9rem;
}

.catchable-list img,
.catchable-missing {
  width: 54px;
  height: 54px;
}

.catchable-list img {
  object-fit: contain;
  image-rendering: pixelated;
}

.catchable-missing {
  display: grid;
  place-items: center;
  color: #777;
  font-size: 1.8rem;
  font-weight: 900;
}

.catchable-details {
  display: grid;
  gap: 3px;
}

.catchable-number {
  color: #a6a6a6;
  font-weight: 800;
}

.catchable-name {
  overflow-wrap: anywhere;
}

@media (max-width: 520px) {
  .game-v2 {
    padding: 8px;
  }

  .game-panel {
    padding: 16px;
  }

  .pokemon-info h2 {
    font-size: 1.55rem;
  }
}
</style>
