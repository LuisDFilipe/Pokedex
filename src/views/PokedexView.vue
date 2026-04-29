<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface PokemonForm {
  id: string
  name: string
  type1: string | null
  type2: string | null
  gen: number
  sprite: string
  gender: string | null
  region: string | null
  form: string | null
}

interface PokemonEntry {
  id: string
  name: string
  forms: PokemonForm[]
}

interface PokedexJson {
  pokedex: {
    pokemon: PokemonEntry[]
  }
}

const itemsPerPage = ref(10)
const pageSizeOptions = [5, 10, 20, 30, 50, 100]
const page = ref(1)
const filterQuery = ref('')
const pokemonList = ref<PokemonEntry[]>([])
const loading = ref(true)
const error = ref('')
const selectedPokemon = ref<PokemonEntry | null>(null)

const type_colors: Record<string, string> = {
  Normal: '#A8A77ABE',
  Fire: '#EE8130BE',
  Water: '#6390F0BE',
  Electric: '#F7D02CBE',
  Grass: '#7AC74CBE',
  Ice: '#96D9D6BE',
  Fighting: '#C22E28BE',
  Poison: '#A33EA1BE',
  Ground: '#E2BF65BE',
  Flying: '#A98FF3BE',
  Psychic: '#F95587BE',
  Bug: '#A6B91ABE',
  Rock: '#B6A136BE',
  Ghost: '#735797BE',
  Dragon: '#6F35FCBE',
  Dark: '#705746BE',
  Steel: '#B7B7CEBE',
  Fairy: '#D685ADBE',
}

const spriteModules = import.meta.glob('../../sprites/pokemon/normal/*.png', {
  eager: true,
  as: 'url',
}) as Record<string, string>

const spriteMap = Object.fromEntries(
  Object.entries(spriteModules).map(([path, url]) => {
    const fileName = path.split('/').pop() ?? ''
    const id = fileName.replace('.png', '')
    return [id, url]
  }),
) as Record<string, string>

const filteredPokemon = computed(() => {
  const query = filterQuery.value.trim().toLowerCase()
  if (!query) {
    return pokemonList.value
  }

  return pokemonList.value.filter((pokemon) => {
    const id = pokemon.id.toLowerCase()
    const name = pokemon.name.toLowerCase()
    const type1 = pokemon.forms[0]?.type1?.toLowerCase() ?? ''
    const type2 = pokemon.forms[0]?.type2?.toLowerCase() ?? ''
    const numberMatch = id.includes(query)
    const nameMatch = name.includes(query)
    const typeMatch = type1.includes(query) || type2.includes(query)
    return numberMatch || nameMatch || typeMatch
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredPokemon.value.length / itemsPerPage.value)))

watch(page, (value) => {
  if (value < 1) {
    page.value = 1
  } else if (value > pageCount.value) {
    page.value = pageCount.value
  }
})

watch(itemsPerPage, () => {
  page.value = 1
})

watch(filterQuery, () => {
  page.value = 1
})

const pagedPokemon = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  return filteredPokemon.value.slice(start, start + itemsPerPage.value)
})

const currentRange = computed(() => {
  const start = filteredPokemon.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1
  const end = Math.min(page.value * itemsPerPage.value, filteredPokemon.value.length)
  return `${start}-${end}`
})

const getTypeBackground = (pokemon: PokemonEntry) => {
  const primary = pokemon.forms[0]?.type1
  const secondary = pokemon.forms[0]?.type2

  const primaryColor = primary ? type_colors[primary] ?? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.08)'
  const secondaryColor = secondary ? type_colors[secondary] ?? primaryColor : null

  if (!secondaryColor) {
    return primaryColor
  }

  return `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} 50%, ${secondaryColor} 50%, ${secondaryColor} 100%)`
}

const getSpriteUrl = (id: string) => {
  return spriteMap[id] ?? ''
}

const loadPokedex = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch('/pokedex.json')
    if (!response.ok) {
      throw new Error(`Failed to load pokedex.json: ${response.status}`)
    }

    const data = (await response.json()) as PokedexJson
    pokemonList.value = data.pokedex.pokemon
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

const prevPage = () => {
  page.value = Math.max(1, page.value - 1)
}

const nextPage = () => {
  page.value = Math.min(pageCount.value, page.value + 1)
}

const selectPokemon = (pokemon: PokemonEntry) => {
  selectedPokemon.value = pokemon
}

const closeDetail = () => {
  selectedPokemon.value = null
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && selectedPokemon.value) {
    closeDetail()
  }
}

onMounted(() => {
  loadPokedex()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <section class="pokedex-view">
    <div class="page-header">
      <div class="page-meta">
        <div class="page-meta-left">
          <span v-if="loading">Loading...</span>
          <span v-else-if="error" class="error">{{ error }}</span>
          <span v-else>{{ filteredPokemon.length }} Pokémon · Showing {{ currentRange }} of {{ filteredPokemon.length }}</span>
          <label v-if="!loading && !error" class="filter-search">
            <span>Filter</span>
            <input
              v-model="filterQuery"
              type="search"
              placeholder="Name, type, or number"
              aria-label="Filter Pokémon by name, type, or number"
            />
          </label>
        </div>

        <div class="page-meta-right">
          <label v-if="!loading && !error" class="page-size-selector">
            Show
            <select v-model.number="itemsPerPage" aria-label="Items per page">
              <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
            </select>
            per page
          </label>
        </div>
      </div>
    </div>

    <div v-if="selectedPokemon" class="pokemon-modal" @click.self="closeDetail">
      <div class="detail-card" role="dialog" aria-modal="true">
        <button class="detail-close" @click="closeDetail">×</button>
        <div class="detail-main">
          <div class="detail-image">
            <img :src="getSpriteUrl(selectedPokemon.id)" :alt="selectedPokemon.name" />
          </div>
          <div class="detail-text">
            <h2>{{ selectedPokemon.id }} · {{ selectedPokemon.name }}</h2>
            <div class="detail-type-pills">
              <span
                v-if="selectedPokemon.forms[0]?.type1"
                class="type-pill"
                :style="{ background: type_colors[selectedPokemon.forms[0].type1] || 'rgba(255,255,255,0.18)', color: '#111' }"
              >
                {{ selectedPokemon.forms[0].type1 }}
              </span>
              <span
                v-if="selectedPokemon.forms[0]?.type2"
                class="type-pill"
                :style="{ background: type_colors[selectedPokemon.forms[0].type2] || 'rgba(255,255,255,0.18)', color: '#111' }"
              >
                {{ selectedPokemon.forms[0].type2 }}
              </span>
            </div>
            <p class="detail-forms"><strong>Forms:</strong> {{ selectedPokemon.forms.length }}</p>
          </div>
        </div>

        <div class="detail-forms-list">
          <h3>Forms</h3>
          <ul>
            <li v-for="form in selectedPokemon.forms" :key="form.id">
              <strong>{{ form.name }}</strong>
              <span>• {{ form.type1 || 'Unknown' }}<span v-if="form.type2"> / {{ form.type2 }}</span></span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="!loading && !error" class="pokemon-grid">
      <article v-for="pokemon in pagedPokemon" :key="pokemon.id" class="pokemon-card" @click="selectPokemon(pokemon)" :style="{ background: getTypeBackground(pokemon) }">
        <div class="pokemon-card__image">
          <img :src="getSpriteUrl(pokemon.forms[0]?.sprite || pokemon.id)" :alt="pokemon.name" loading="lazy" />
        </div>
        <div class="pokemon-card__info">
          <h2>{{ pokemon.id }} · {{ pokemon.name }}</h2>
          <p>
            <span>{{ pokemon.forms[0]?.type1 || "Unknown" }}</span>
            <span v-if="pokemon.forms[0] && pokemon.forms[0].type2"> / {{ pokemon.forms[0].type2 }}</span>
          </p>
          <p class="form-label">{{ (pokemon.forms.length) === 1 ? "·" : `${ pokemon.forms.length } forms available` }}</p>
        </div>
      </article>
    </div>

    <div v-if="!loading && !error" class="pagination">
      <button @click="prevPage" :disabled="page === 1">Previous</button>
      <div class="pagination-center">
        <span>Page {{ page }} of {{ pageCount }}</span>
      </div>
      <button @click="nextPage" :disabled="page === pageCount">Next</button>
      <div class="pagination-center">
        <label>
          Go to page
          <input
            type="number"
            v-model.number="page"
            :min="1"
            :max="pageCount"
            aria-label="Select page"
          />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pokedex-view {
  padding: 24px;
  color: #ececec;
}

.page-header {
  /* display: flex; */
  /* flex-wrap: wrap; */
  /* align-items: center; */
  /* justify-content: space-between; */
  /* gap: 16px; */
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: clamp(2rem, 2.4vw, 2.6rem);
}

.page-header p {
  margin: 0;
  color: #b8b8b8;
}

.page-meta {
  font-size: 0.95rem;
  color: #a6a6a6;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px 24px;
  align-items: start;
}

.page-meta-left {
  display: grid;
  gap: 10px;
  text-align: left;
}

.page-meta-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.page-meta .error {
  color: #ff6b6b;
}

.page-size-selector,
.filter-search {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #a6a6a6;
}

.filter-search {
  flex-wrap: wrap;
  width: min(480px, 100%);
}

.filter-search input {
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 10px 12px;
}

.filter-search input::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.page-size-selector select {
  width: 96px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.92);
  color: #111;
  padding: 8px 10px;
}

@media (max-width: 720px) {
  .page-meta {
    grid-template-columns: 1fr;
  }

  .page-meta-right {
    justify-content: flex-start;
  }

  .filter-search,
  .page-size-selector {
    width: 100%;
  }
}

.page-size-selector select option {
  color: #111;
  background: #fff;
}

.pokemon-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(5, minmax(180px, 1fr));
}

@media (max-width: 1280px) {
  .pokemon-grid {
    grid-template-columns: repeat(4, minmax(180px, 1fr));
  }
}

@media (max-width: 990px) {
  .pokemon-grid {
    grid-template-columns: repeat(3, minmax(180px, 1fr));
  }
}

@media (max-width: 720px) {
  .pokemon-grid {
    grid-template-columns: repeat(2, minmax(160px, 1fr));
  }
}

@media (max-width: 520px) {
  .pokemon-grid {
    grid-template-columns: 1fr;
  }
}

.pokemon-card {
  background: rgba(255, 255, 255, 0.05);
  /* border: 1px solid rgba(255, 255, 255, 0.08); */
  border-radius: 18px;
  padding: 18px;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.pokemon-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
}

.pokemon-modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.75);
  z-index: 9999;
  padding: 24px;
}

.detail-card {
  width: min(980px, 100%);
  background: rgba(15, 15, 15, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  padding: 24px;
  color: #f6f6f6;
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.35);
  position: relative;
}

.detail-close {
  position: absolute;
  top: 18px;
  right: 18px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font-size: 1.1rem;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  transition: background 0.2s ease, transform 0.2s ease;
}

.detail-close:hover {
  background: rgba(255, 255, 255, 0.14);
  transform: scale(1.05);
}

.detail-main {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
}

.detail-image {
  flex: 0 0 180px;
  display: grid;
  place-items: center;
  min-height: 180px;
}

.detail-image img,
.pokemon-card__image img {
  max-width: 100%;
  max-height: 180px;
  filter: drop-shadow(0px 0px 5px rgba(255, 255, 255, 0.5)) drop-shadow(1px 1px 0px rgb(0, 0, 0));
}

.detail-text {
  flex: 1;
}

.detail-text h2 {
  margin: 0 0 12px;
}

.detail-types,
.detail-forms {
  margin: 8px 0 0;
  color: #d1d1d1;
}

.detail-type-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0 0;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18), 0 4px 10px rgba(0, 0, 0, 0.18);
}

.detail-forms {
  margin-top: 16px;
}

.detail-forms-list {
  margin-top: 20px;
}

.detail-forms-list h3 {
  margin: 0 0 12px;
}

.detail-forms-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.detail-forms-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.95rem;
  color: #e4e4e4;
}

.detail-forms-list li strong {
  min-width: 160px;
}

.pokemon-card__image {
  display: grid;
  place-items: center;
  margin-bottom: 16px;
  min-height: 120px;
}

.pokemon-card__image img {
  max-width: 100%;
  max-height: 120px;
}

.pokemon-card__info h2 {
  margin: 0 0 8px;
  font-size: 1.1rem;
}

.pokemon-card__info p {
  margin: 0;
  color: #d1d1d1;
}

.form-label {
  margin-top: 8px;
  font-size: 0.9rem;
  color: #9a9a9a;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 28px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 28px;
  flex-wrap: wrap;
}

.pagination-center {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #d1d1d1;
}

.pagination-center label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: #d1d1d1;
}

.pagination-center input,
.pagination-center select {
  width: 80px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
}

.pagination button {
  border: none;
  background: #ff4747;
  color: white;
  padding: 10px 18px;
  border-radius: 999px;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pagination span {
  color: #d1d1d1;
}
</style>
