<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface PokemonForm {
  id: string
  name: string
  type1: string
  type2: string | null
  gen: number
  sprite: string
  gender: string | null
  region: string | null
  form: string | null
  boxable: boolean
  //show_gender: boolean | null
  //has_gender_difference: boolean | null
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
const pageDraft = ref(1)
const filterQuery = ref('')
const pokemonList = ref<PokemonEntry[]>([])
const loading = ref(true)
const error = ref('')
const selectedPokemon = ref<PokemonEntry | null>(null)
const selectedForm = ref<PokemonForm | null>(null)
const showFilterModal = ref(false)
const selectedGenerations = ref<number[]>([])
const excludeGigantamax = ref(false)
const excludeMegas = ref(false)
const showBoxableOnly = ref(false)
const showBaseFormOnly = ref(false)

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

const normalSpriteMap = Object.fromEntries(
  Object.entries(normalSprites).map(([path, url]) => {
    const fileName = path.split('/').pop() ?? ''
    const id = fileName.replace('.png', '')
    return [id, url]
  }),
) as Record<string, string>

const shinySpriteMap = Object.fromEntries(
  Object.entries(shinySprites).map(([path, url]) => {
    const fileName = path.split('/').pop() ?? ''
    const id = fileName.replace('.png', '')
    return [id, url]
  }),
) as Record<string, string>

const allGenerations = computed(() => {
  const gens = new Set<number>()
  pokemonList.value.forEach((pokemon) => {
    pokemon.forms.forEach((form) => {
      if (form.gen) {
        gens.add(form.gen)
      }
    })
  })
  return Array.from(gens).sort((a, b) => a - b)
})

// Flatten all forms from all pokemon for filtering
const allFormsFlat = computed(() => {
  return pokemonList.value.flatMap((pokemon) =>
    pokemon.forms.map((form, index) => ({
      ...form,
      pokemonName: pokemon.name,
      pokemonId: pokemon.id,
      isBaseForm: index === 0,
    }))
  )
})

const isFormExcluded = (form: PokemonForm & { isBaseForm?: boolean }): boolean => {
  if (excludeGigantamax.value && form.form?.toLowerCase().includes('gigantamax')) {
    return true
  }
  if (excludeMegas.value && form.form?.toLowerCase().includes('mega')) {
    return true
  }
  if (showBoxableOnly.value && !form.boxable) {
    return true
  }
  if (showBaseFormOnly.value && !form.isBaseForm) {
    return true
  }
  if (selectedGenerations.value.length > 0 && !selectedGenerations.value.includes(form.gen)) {
    return true
  }
  return false
}

const filteredPokemon = computed(() => {
  const query = filterQuery.value.trim().toLowerCase()

  // Filter forms first
  const filteredForms = allFormsFlat.value.filter((form) => {
    if (isFormExcluded(form)) return false

    if (!query) return true

    const id = form.id.toLowerCase()
    const name = form.name.toLowerCase()
    const pokemonName = form.pokemonName.toLowerCase()
    const type1 = form.type1?.toLowerCase() ?? ''
    const type2 = form.type2?.toLowerCase() ?? ''

    return (
      id.includes(query) ||
      name.includes(query) ||
      pokemonName.includes(query) ||
      type1.includes(query) ||
      type2.includes(query)
    )
  })

  return filteredForms
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredPokemon.value.length / itemsPerPage.value)))

watch(pageDraft, (value) => {  
  if (value >= 1 && value <= pageCount.value) {
    page.value = pageDraft.value
  }
})

watch(itemsPerPage, () => {
  page.value = 1
  pageDraft.value = 1
})

watch(filterQuery, () => {
  page.value = 1
  pageDraft.value = 1
})

watch(selectedGenerations, () => {
  page.value = 1
  pageDraft.value = 1
})

watch(excludeGigantamax, () => {
  page.value = 1
  pageDraft.value = 1
})

watch(excludeMegas, () => {
  page.value = 1
  pageDraft.value = 1
})

watch(showBoxableOnly, () => {
  page.value = 1
  pageDraft.value = 1
})

watch(showBaseFormOnly, () => {
  page.value = 1
  pageDraft.value = 1
})

watch(selectedGenerations, (newVal) => {
  localStorage.setItem('selectedGenerations', JSON.stringify(newVal))
}, { deep: true })

watch(excludeGigantamax, (newVal) => {
  localStorage.setItem('excludeGigantamax', newVal.toString())
})

watch(excludeMegas, (newVal) => {
  localStorage.setItem('excludeMegas', newVal.toString())
})

watch(showBoxableOnly, (newVal) => {
  localStorage.setItem('showBoxableOnly', newVal.toString())
})

watch(showBaseFormOnly, (newVal) => {
  localStorage.setItem('showBaseFormOnly', newVal.toString())
})

watch(filterQuery, (newVal) => {
  localStorage.setItem('filterQuery', newVal)
})

watch(itemsPerPage, (newVal) => {
  localStorage.setItem('itemsPerPage', newVal.toString())
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

  if (!secondaryColor) return primaryColor

  return `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} 50%, ${secondaryColor} 50%, ${secondaryColor} 100%)`
}

const getSpriteUrl = (id: string) => {
  return normalSpriteMap[id] ?? ''
  //if(true)
  //  return normalSpriteMap[id] ?? ''
  //else 
  //  return shinySpriteMap[id] ?? ''
}

const getGenderIcons = (gender: string | null) => {
  if (!gender) return []

  const normalized = gender.toLowerCase()
  const icons: string[] = []

  if (normalized.includes('female')) {
    icons.push('/female.png')
  } else if (normalized.includes('male')) {
    icons.push('/male.png')
  }

  return icons
}

const activeForm = computed(() => {
  return selectedForm.value ?? selectedPokemon.value?.forms[0] ?? null
})

const activeGenderIcons = computed(() => {
  return getGenderIcons(activeForm.value?.gender ?? null)
})

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
  pageDraft.value = page.value
}

const nextPage = () => {
  page.value = Math.min(pageCount.value, page.value + 1)
  pageDraft.value = page.value
}

const selectPokemon = (pokemon: PokemonEntry) => {
  selectedPokemon.value = pokemon
  selectedForm.value = pokemon.forms[0] ?? null
}

const selectForm = (form: PokemonForm) => {
  selectedForm.value = form
}

const selectFormFromGrid = (form: PokemonForm & { pokemonName: string; pokemonId: string }) => {
  // Find the pokemon entry that contains this form
  const pokemon = pokemonList.value.find((p) => p.id === form.pokemonId)
  if (pokemon) {
    selectedPokemon.value = pokemon
    selectedForm.value = form
  }
}

const closeDetail = () => {
  selectedPokemon.value = null
  selectedForm.value = null
}

const toggleGenerationFilter = (gen: number) => {
  const index = selectedGenerations.value.indexOf(gen)
  if (index > -1) {
    selectedGenerations.value.splice(index, 1)
  } else {
    selectedGenerations.value.push(gen)
  }
  page.value = 1
  pageDraft.value = 1
}

const isGenerationSelected = (gen: number) => {
  return selectedGenerations.value.includes(gen)
}

const clearFilters = () => {
  selectedGenerations.value = []
  excludeGigantamax.value = false
  excludeMegas.value = false
  showBoxableOnly.value = false
  showBaseFormOnly.value = false
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && selectedPokemon.value) {
    closeDetail()
  }
  if (event.key === 'Escape' && showFilterModal.value) {
    showFilterModal.value = false
  }
}

onMounted(async () => {
  await loadPokedex()
  // Load saved filters
  const savedGenerations = localStorage.getItem('selectedGenerations')
  if (savedGenerations) {
    selectedGenerations.value = JSON.parse(savedGenerations)
  }
  excludeGigantamax.value = localStorage.getItem('excludeGigantamax') === 'true'
  excludeMegas.value = localStorage.getItem('excludeMegas') === 'true'
  showBoxableOnly.value = localStorage.getItem('showBoxableOnly') === 'true'
  showBaseFormOnly.value = localStorage.getItem('showBaseFormOnly') === 'true'
  const savedQuery = localStorage.getItem('filterQuery')
  if (savedQuery) {
    filterQuery.value = savedQuery
  }
  const savedItemsPerPage = localStorage.getItem('itemsPerPage')
  if (savedItemsPerPage) {
    itemsPerPage.value = parseInt(savedItemsPerPage)
  }
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
          <span v-else>{{ filteredPokemon.length }} form{{ filteredPokemon.length !== 1 ? 's' : '' }} · Showing {{ currentRange }} of {{ filteredPokemon.length }}</span>
          <label v-if="!loading && !error" class="filter-search">
            <span>Filter</span>
            <input
              v-model="filterQuery"
              type="search"
              placeholder="Name, Type, or Number"
              aria-label="Filter Pokémon by Name, Type, or Number"
            />
          </label>
        </div>

        <div class="page-meta-right">
          <button v-if="!loading && !error" class="filter-btn" @click="showFilterModal = true" title="Open filter settings">
            Filters
          </button>
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
        <div class="detail-badge">#{{ selectedPokemon.id }}</div>
        <div class="detail-main">
          <div class="detail-image">
            <img
              :src="getSpriteUrl(activeForm?.sprite || selectedPokemon.id)"
              :alt="`${selectedPokemon.name} ${activeForm?.name ?? ''}`"
            />
            <div v-if="activeGenderIcons.length" class="gender-overlay">
              <img
                v-for="src in activeGenderIcons"
                :key="src"
                :src="src"
                class="gender-icon"
                :alt="src.includes('male') ? 'Male' : 'Female'"
              />
            </div>
          </div>
          <div class="detail-text">
            <h2>
              {{ selectedPokemon.id }} · {{ selectedPokemon.name }}
              <small v-if="activeForm?.name && activeForm?.name !== selectedPokemon.name">({{ activeForm.name }})</small>
            </h2>
            <div class="detail-type-pills">
              <span
                v-if="activeForm?.type1"
                class="type-pill"
                :style="{ background: type_colors[activeForm.type1] || 'rgba(255,255,255,0.18)', color: '#111' }"
              >
                {{ activeForm.type1 }}
              </span>
              <span
                v-if="activeForm?.type2"
                class="type-pill"
                :style="{ background: type_colors[activeForm.type2] || 'rgba(255,255,255,0.18)', color: '#111' }"
              >
                {{ activeForm.type2 }}
              </span>
            </div>
            <p v-if="activeForm?.gen" class="detail-extra"><strong>Gen:</strong> {{ activeForm.gen }}</p>
            <p v-if="activeForm?.region" class="detail-extra"><strong>Region:</strong> {{ activeForm.region }}</p>
          </div>
        </div>

        <div class="detail-forms-list">
          <h3>Forms</h3>
          <ul>
            <li v-for="form in selectedPokemon.forms" :key="form.id">
              <button
                type="button"
                class="form-option"
                :class="{ active: activeForm?.id === form.id }"
                @click="selectForm(form)"
              >
                <div>
                  <strong>{{ form.name }}</strong>
                  <span>• {{ form.type1 || 'Unknown' }}<span v-if="form.type2"> / {{ form.type2 }}</span></span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="showFilterModal" class="filter-modal" @click.self="showFilterModal = false">
      <div class="filter-panel" role="dialog" aria-modal="true">
        <div class="filter-header">
          <h2>Filter Settings</h2>
          <button class="filter-close" @click="showFilterModal = false">×</button>
        </div>

        <div class="filter-content">
          <!-- Generation Filter -->
          <div class="filter-section">
            <h3>Generation</h3>
            <div class="filter-options">
              <label v-for="gen in allGenerations" :key="gen" class="filter-checkbox">
                <input
                  type="checkbox"
                  :checked="isGenerationSelected(gen)"
                  @change="toggleGenerationFilter(gen)"
                />
                <span>Gen {{ gen }}</span>
              </label>
            </div>
          </div>

          <!-- Gigantamax Filter -->
          <div class="filter-section">
            <h3>Special Forms</h3>
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="excludeGigantamax"
                :disabled="showBaseFormOnly"
              />
              <span>Exclude Gigantamax</span>
            </label>
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="excludeMegas"
                :disabled="showBaseFormOnly"
              />
              <span>Exclude Megas</span>
            </label>
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="showBoxableOnly"
                :disabled="showBaseFormOnly"
              />
              <span>Show Only Boxable Forms</span>
            </label>
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="showBaseFormOnly"
              />
              <span>Hide all forms</span>
            </label>
          </div>
        </div>

        <div class="filter-footer">
          <button class="btn-clear" @click="clearFilters">Clear Filters</button>
          <button class="btn-close" @click="showFilterModal = false">Done</button>
        </div>
      </div>
    </div>

    <div v-if="!loading && !error" class="pokemon-grid">
      <article 
        v-for="form in pagedPokemon" 
        :key="form.id" 
        class="pokemon-card" 
        @click="selectFormFromGrid(form)"
        :style="{ background: form.type2
          ? `linear-gradient(to right, ${type_colors[form.type1] || 'rgba(255,255,255,0.08)'} 0%, ${type_colors[form.type1] || 'rgba(255,255,255,0.08)'} 50%, ${type_colors[form.type2] || 'rgba(255,255,255,0.08)'} 50%, ${type_colors[form.type2] || 'rgba(255,255,255,0.08)'} 100%)`
          : type_colors[form.type1] || 'rgba(255,255,255,0.08)' }"
      >
        <div class="pokemon-card_badge">#{{ form.pokemonId }}</div>
        <div class="pokemon-card_gender" v-if="!showBaseFormOnly && getGenderIcons(form.gender).length">
          <img
            v-for="src in getGenderIcons(form.gender)"
            :key="src"
            :src="src"
            :alt="src.includes('female') ? 'Female' : 'Male'"
          />
        </div>
        <div class="pokemon-card_image">
          <img :src="getSpriteUrl(form.sprite || form.id)" :alt="form.name" loading="lazy" />
        </div>
        <div class="pokemon-card_info">
          <h2>{{ form.pokemonName }}</h2>
          <p>
            <span>{{ form.type1 || "Unknown" }}</span>
            <span v-if="form.type2"> / {{ form.type2 }}</span>
          </p>
          <p class="form-label">{{ form.name === form.pokemonName ? '·' : form.name }}</p>
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
            v-model.number="pageDraft"
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
  gap: 16px;
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
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 18px;
  padding: 10px;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
  text-shadow: 1px 1px 5px rgba(0, 0, 0, 0.5);
}

.pokemon-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
}

.pokemon-card_badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 2px 4px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.18);
  color: #f0f0f0;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  z-index: 1;
}

.pokemon-card_gender {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  z-index: 1;
}

.pokemon-card_gender img {
  width: 22px;
  height: 22px;
  padding: 2px;
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

.detail-badge {
  position: absolute;
  top: 18px;
  left: 18px;
  padding: 4px 8px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.18);
  color: #f0f0f0;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  z-index: 1;
}

.detail-main {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
}

@media (max-width: 720px) {
  .detail-main {
    flex-direction: column;
  }
}

.detail-image {
  flex: 0 0 180px;
  display: grid;
  place-items: center;
  min-height: 180px;
  position: relative;
}

.gender-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.gender-icon {
  width: 28px;
  height: 28px;
  /* background: rgba(0, 0, 0, 0.3); */
  padding: 4px;
}

.detail-image img,
.pokemon-card_image img {
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
.detail-forms,
.detail-extra {
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
  padding: 2px 6px;
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
  max-height: 300px;
  overflow-y: auto;
}

.detail-forms-list li {
  display: block;
}

.detail-extra {
  margin-top: 16px;
}
.form-option {
  width: 100%;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #eaeaea;
  border-radius: 16px;
  padding: 14px 16px;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.form-option:hover {
  background: rgba(255, 255, 255, 0.08);
}

.form-option.active {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.12);
}

.form-option div {
  display: grid;
  gap: 6px;
}

.form-option strong {
  display: block;
}

.detail-forms-list li strong {
  min-width: 160px;
}

.pokemon-card_image {
  display: grid;
  place-items: center;
  margin-bottom: 10px;
  min-height: 120px;
}

.pokemon-card_image img {
  max-width: 100%;
  max-height: 120px;
}

.pokemon-card_info h2 {
  margin: 0 0 8px;
  font-size: 1.1rem;
}

.pokemon-card_info p {
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

.filter-btn {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: #eaeaea;
  padding: 10px 16px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s ease, border-color 0.2s ease;
  white-space: nowrap;
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.24);
}

.filter-modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.25);
  z-index: 9998;
  padding: 24px;
  /* backdrop-filter: blur(4px); */
}

.filter-panel {
  width: min(500px, 100%);
  background: rgba(15, 15, 15, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  padding: 0;
  color: #f6f6f6;
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow: hidden;
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.filter-header h2 {
  margin: 0;
  font-size: 1.3rem;
}

.filter-close {
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font-size: 1.2rem;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  transition: background 0.2s ease, transform 0.2s ease;
  flex-shrink: 0;
}

.filter-close:hover {
  background: rgba(255, 255, 255, 0.14);
  transform: scale(1.05);
}

.filter-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: grid;
  gap: 24px;
}

.filter-section {
  display: grid;
  gap: 12px;
}

.filter-section h3 {
  margin: 0;
  font-size: 1rem;
  color: #eaeaea;
}

.filter-options {
  display: grid;
  gap: 10px;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: #d1d1d1;
  transition: color 0.2s ease;
}

.filter-checkbox:hover {
  color: #eaeaea;
}

.filter-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #ff4747;
}

.filter-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.btn-clear,
.btn-close {
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s ease;
}

.btn-clear {
  background: rgba(255, 255, 255, 0.08);
  color: #d1d1d1;
  flex: 1;
}

.btn-clear:hover {
  background: rgba(255, 255, 255, 0.14);
}

.btn-close {
  background: #ff4747;
  color: white;
  flex: 1;
}

.btn-close:hover {
  background: #ff5757;
}
</style>
