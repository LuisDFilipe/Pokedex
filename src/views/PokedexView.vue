<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  createSyncPayload,
  defaultSettings,
  loadPokedex,
  parseSyncPayload,
  readCollection,
  readSettings,
  writeCollection,
  writeSettings,
} from '@/lib/pokedex'
import type { PokedexSettings, PokemonEntry, PokemonForm } from '@/types/pokedex'

const itemsPerPage = ref(10)
const pageSizeOptions = [5, 6, 10, 12, 18, 20, 24, 30, 50, 60, 100]
const page = ref(1)
const pageDraft = ref(1)
const filterQuery = ref('')
const debouncedQuery = ref('')
const collectedNormal = ref<string[]>([])
const collectedShiny = ref<string[]>([])
const showCollectedOnly = ref(false)
const showUncollectedOnly = ref(false)
const pokemonList = ref<PokemonEntry[]>([])
const loading = ref(true)
const error = ref('')
const selectedPokemon = ref<PokemonEntry | null>(null)
const selectedForm = ref<PokemonForm | null>(null)
const localShowShiny = ref(false)
const showFilterModal = ref(false)
const selectedGenerations = ref<number[]>([])
const excludeGigantamax = ref(false)
const excludeMegas = ref(false)
const showBoxableOnly = ref(false)
const showBaseFormOnly = ref(false)
const showShiny = ref(false)
const importFile = ref<HTMLInputElement | null>(null)
const syncMessage = ref('')
const syncMessageType = ref<'success' | 'error' | ''>('')
const groupForms = ref(false)
const speciesActiveFormId = ref<Record<string, string>>({})

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

const isCollected = (id: string, isShiny: boolean) => {
  const list = isShiny ? collectedShiny.value : collectedNormal.value
  return list.includes(id)
}

const toggleCollection = (id: string, isShiny: boolean) => {
  const list = isShiny ? collectedShiny.value : collectedNormal.value
  const index = list.indexOf(id)
  if (index > -1) {
    list.splice(index, 1)
  } else {
    list.push(id)
  }
  saveCollection()
  saveSettings()
}

const isFormExcluded = (form: PokemonForm & { isBaseForm?: boolean }): boolean => {
  if (excludeGigantamax.value && form.form?.toLowerCase().includes('gigantamax')) {
    return true
  }
  if (excludeMegas.value && (form.form?.toLowerCase().includes('mega') || form.form?.toLowerCase().includes('primal'))) {
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

const isFormVisible = (form: PokemonForm & { pokemonName: string; pokemonId: string; isBaseForm: boolean }, query: string = ''): boolean => {
  if (isFormExcluded(form)) return false

  // Collection Filters
  const normalCollected = collectedNormal.value.includes(form.id)
  const shinyCollected = collectedShiny.value.includes(form.id)

  if (showCollectedOnly.value) {
    const isCurrentlyShiny = showShiny.value
    if (isCurrentlyShiny && !shinyCollected) return false
    if (!isCurrentlyShiny && !normalCollected) return false
  }

  if (showUncollectedOnly.value) {
    const isCurrentlyShiny = showShiny.value
    if (isCurrentlyShiny && shinyCollected) return false
    if (!isCurrentlyShiny && normalCollected) return false
  }

  if (!query) return true

  const q = query.trim().toLowerCase()
  return (
    form.id.toLowerCase().includes(q) ||
    form.name.toLowerCase().includes(q) ||
    form.pokemonName.toLowerCase().includes(q) ||
    (form.type1?.toLowerCase() ?? '').includes(q) ||
    (form.type2?.toLowerCase() ?? '').includes(q)
  )
}

const filteredPokemon = computed(() => {
  const query = debouncedQuery.value

  // Filter base forms list first
  const flatResults = allFormsFlat.value.filter((form) => isFormVisible(form, query))

  if (!groupForms.value) return flatResults

  // Group results by species if carousel mode is active
  // A species is included if at least one of its forms matches the filters
  const seen = new Set<string>()
  const speciesList: PokemonEntry[] = []
  flatResults.forEach((form) => {
    if (!seen.has(form.pokemonId)) {
      seen.add(form.pokemonId)
      const pokemon = pokemonList.value.find((p) => p.id === form.pokemonId)
      if (pokemon) speciesList.push(pokemon)
    }
  })
  return speciesList
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredPokemon.value.length / itemsPerPage.value)))

watch(pageDraft, (value) => {  
  if (value >= 1 && value <= pageCount.value) {
    page.value = pageDraft.value
  }
})

// Debounce search query to improve performance
let debounceTimer: ReturnType<typeof setTimeout>
watch(filterQuery, (newVal) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = newVal
  }, 300)
})

const saveCollection = () => {
  writeCollection({
    normal: collectedNormal.value,
    shiny: collectedShiny.value,
  })
}

const getCurrentSettings = (): PokedexSettings => ({
  selectedGenerations: selectedGenerations.value,
  excludeGigantamax: excludeGigantamax.value,
  excludeMegas: excludeMegas.value,
  showBoxableOnly: showBoxableOnly.value,
  showBaseFormOnly: showBaseFormOnly.value,
  showShiny: showShiny.value,
  showCollectedOnly: showCollectedOnly.value,
  showUncollectedOnly: showUncollectedOnly.value,
  filterQuery: filterQuery.value,
  itemsPerPage: itemsPerPage.value,
  groupForms: groupForms.value,
})

const applySettings = (settings: PokedexSettings) => {
  selectedGenerations.value = settings.selectedGenerations
  excludeGigantamax.value = settings.excludeGigantamax
  excludeMegas.value = settings.excludeMegas
  showBoxableOnly.value = settings.showBoxableOnly
  showBaseFormOnly.value = settings.showBaseFormOnly
  showShiny.value = settings.showShiny
  showCollectedOnly.value = settings.showCollectedOnly
  showUncollectedOnly.value = settings.showUncollectedOnly
  filterQuery.value = settings.filterQuery
  debouncedQuery.value = settings.filterQuery
  itemsPerPage.value = settings.itemsPerPage
  groupForms.value = settings.groupForms
}

const saveSettings = () => {
  writeSettings({
    selectedGenerations: selectedGenerations.value,
    excludeGigantamax: excludeGigantamax.value,
    excludeMegas: excludeMegas.value,
    showBoxableOnly: showBoxableOnly.value,
    showBaseFormOnly: showBaseFormOnly.value,
    showShiny: showShiny.value,
    showCollectedOnly: showCollectedOnly.value,
    showUncollectedOnly: showUncollectedOnly.value,
    filterQuery: filterQuery.value,
    itemsPerPage: itemsPerPage.value,
    groupForms: groupForms.value,
  })  
}

watch(showCollectedOnly, (newVal) => { if (newVal) showUncollectedOnly.value = false })
watch(showUncollectedOnly, (newVal) => { if (newVal) showCollectedOnly.value = false })

watch(
  [selectedGenerations, excludeGigantamax, excludeMegas, showBoxableOnly, showBaseFormOnly, filterQuery, itemsPerPage, showCollectedOnly, showUncollectedOnly, groupForms],
  () => {
    page.value = 1
    pageDraft.value = 1
    saveSettings()
  },
  { deep: true }
)

watch(showShiny, () => {
  if(showCollectedOnly.value == true || showUncollectedOnly.value == true) {
    page.value = 1
    pageDraft.value = 1
  }
  saveSettings()
})

const pagedPokemon = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  const items = filteredPokemon.value.slice(start, start + itemsPerPage.value)

  if (!groupForms.value) {
    return items as (PokemonForm & { pokemonName: string; pokemonId: string; isBaseForm: boolean })[]
  }

  // In grouped mode, transform species list into carousel objects
  return items.map((pokemon: any) => {
    const validForms = pokemon.forms
      .map((f: any, idx: number) => ({ ...f, pokemonName: pokemon.name, pokemonId: pokemon.id, isBaseForm: idx === 0 }))
      .filter((f: any) => isFormVisible(f, debouncedQuery.value))

    const activeFormId = speciesActiveFormId.value[pokemon.id]
    const activeForm = validForms.find((f: any) => f.id === activeFormId) || validForms[0]

    return {
      ...activeForm,
      pokemonName: pokemon.name,
      pokemonId: pokemon.id,
      isBaseForm: pokemon.forms[0].id === activeForm.id,
      isGrouped: true,
      allFormsCount: validForms.length,
      currentFormIndex: validForms.indexOf(activeForm)
    }
  })
})

const currentRange = computed(() => {
  const start = filteredPokemon.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1
  const end = Math.min(page.value * itemsPerPage.value, filteredPokemon.value.length)
  return `${start}-${end}`
})

const getSpriteUrl = (id: string, isShiny: boolean = showShiny.value) => {
  if (isShiny) {
    return shinySpriteMap[id] ?? normalSpriteMap[id] ?? ''
  }
  return normalSpriteMap[id] ?? ''
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

const pokemonFormMap = computed(() => {
  const entries: Array<[string, PokemonForm & { pokemonName: string; pokemonId: string }]> = []

  pokemonList.value.forEach((pokemon) => {
    pokemon.forms.forEach((form) => {
      entries.push([
        form.id,
        {
          ...form,
          pokemonName: pokemon.name,
          pokemonId: pokemon.id,
        },
      ])
    })
  })

  return Object.fromEntries(entries)
})

const activeEvolutionChain = computed(() => {
  const evolutions = activeForm.value?.evolutions ?? []

  return evolutions
    .map((evolution) => {
      const matchedForm = pokemonFormMap.value[evolution.id]

      return {
        id: evolution.id,
        stage: evolution.stage,
        label: matchedForm ? matchedForm.name : evolution.id,
        sprite: matchedForm?.sprite ?? evolution.id,
        pokemonId: matchedForm?.pokemonId ?? null,
        isCurrent: activeForm.value?.id === evolution.id,
      }
    })
    .sort((left, right) => left.stage - right.stage)
})

const loadPokedexData = async () => {
  loading.value = true
  error.value = ''

  try {
    pokemonList.value = await loadPokedex()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

const prevPage = () => {
  page.value = page.value <= 1 ? pageCount.value : page.value - 1
  pageDraft.value = page.value
}

const nextPage = () => {
  page.value = page.value >= pageCount.value ? 1 : page.value + 1
  pageDraft.value = page.value
}

const firstPage = () => {
  page.value = 1
  pageDraft.value = 1
}

const lastPage = () => {
  page.value = pageCount.value
  pageDraft.value = page.value
}

const selectForm = (form: PokemonForm) => {
  selectedForm.value = form
}

const cycleForm = (pokemonId: string, direction: number) => {
  const pokemon = pokemonList.value.find((p) => p.id === pokemonId)
  if (!pokemon) return

  const availableForms = pokemon.forms
    .map((f, index) => ({ ...f, pokemonName: pokemon.name, pokemonId: pokemon.id, isBaseForm: index === 0 }))
    .filter((f) => isFormVisible(f, debouncedQuery.value))

  const currentId = speciesActiveFormId.value[pokemonId]
  let index = availableForms.findIndex((f) => f.id === currentId)
  if (index === -1) index = 0

  index = (index + direction + availableForms.length) % availableForms.length
  speciesActiveFormId.value[pokemonId] = availableForms[index]?.id ?? "0000"
}

const selectFormFromGrid = (form: PokemonForm & { pokemonName: string; pokemonId: string }) => {
  // Find the pokemon entry that contains this form
  const pokemon = pokemonList.value.find((p) => p.id === form.pokemonId)
  if (pokemon) {
    selectedPokemon.value = pokemon
    selectedForm.value = form
    localShowShiny.value = showShiny.value
  }
}

const selectEvolutionForm = (evolutionId: string) => {
  const matchedForm = pokemonFormMap.value[evolutionId]

  if (!matchedForm) {
    return
  }

  const pokemon = pokemonList.value.find((entry) => entry.id === matchedForm.pokemonId)

  if (!pokemon) {
    return
  }

  selectedPokemon.value = pokemon
  selectedForm.value = matchedForm
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
  applySettings(defaultSettings)
}

const setSyncMessage = (message: string, type: 'success' | 'error') => {
  syncMessage.value = message
  syncMessageType.value = type
}

const exportCollection = () => {
  const payload = createSyncPayload(
    {
      normal: collectedNormal.value,
      shiny: collectedShiny.value,
    },
    getCurrentSettings(),
  )

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStamp = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `pokedex-sync-${dateStamp}.json`
  link.click()
  URL.revokeObjectURL(url)

  setSyncMessage('Sync file downloaded. Import it on your other device to restore your collection.', 'success')
}

const importCollection = () => {
  importFile.value?.click()
}

const handleFileImport = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    const rawValue = await file.text()
    const payload = parseSyncPayload(rawValue)

    collectedNormal.value = payload.collection.normal
    collectedShiny.value = payload.collection.shiny
    applySettings(payload.settings)
    page.value = 1
    pageDraft.value = 1

    saveCollection()
    saveSettings()

    setSyncMessage(`Imported sync file from ${new Date(payload.exportedAt).toLocaleString()}.`, 'success')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import sync file.'
    setSyncMessage(message, 'error')
  } finally {
    input.value = ''
  }
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
  await loadPokedexData()

  const savedCollection = readCollection()
  collectedNormal.value = savedCollection.normal
  collectedShiny.value = savedCollection.shiny

  applySettings(readSettings())
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

watch(selectedPokemon, (newVal) => {
  if (newVal) {
    document.body.classList.add('no-scroll')
  } else {
    document.body.classList.remove('no-scroll')
  }
})
</script>

<template>
  <section class="pokedex-view">
    <div class="page-header">
      <div class="page-meta">
        <div class="page-meta-left">
          <span v-if="loading">Loading...</span>
          <span v-else-if="error" class="error">{{ error }}</span>
          <span v-else>{{ filteredPokemon.length }} {{ groupForms ? 'species' : 'forms' }} · {{ collectedNormal.length }} normal collected · {{ collectedShiny.length }} shiny collected</span>
          <label v-if="!loading && !error" class="filter-search">
            <span>Filter</span>
            <input
              v-model="filterQuery"
              type="search"
              placeholder="Name, Type, or Number"
              aria-label="Filter Pokemon by Name, Type, or Number"
            />
          </label>
        </div>

        <div class="page-meta-right">
          <label v-if="!loading && !error" class="shiny-toggle" title="Toggle shiny sprites">
            <div class="switch">
              <input type="checkbox" v-model="showShiny" />
              <span class="slider"></span>
            </div>
            <span>Shiny</span>
          </label>

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
        <div class="detail-header">
          <button class="detail-close" aria-label="Close details" @click="closeDetail">&#10006;</button>
          <div class="detail-main">
            <div class="detail-image">
              <Transition name="sprite-fade" mode="out-in">
                <img
                  :key="`${activeForm?.sprite || selectedPokemon.id}-${localShowShiny}`"
                  :src="getSpriteUrl(activeForm?.sprite || selectedPokemon.id, localShowShiny)"
                  :alt="`${selectedPokemon.name} ${activeForm?.name ?? ''}`"
                  @click="localShowShiny = !localShowShiny"
                  :title="localShowShiny ? 'Click to show normal version' : 'Click to show shiny version'"
                />
              </Transition>
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
              <h2>{{ activeForm?.name || selectedPokemon.name }}</h2>
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
              <!-- <p v-if="activeForm?.gen" class="detail-extra"><strong>Gen:</strong> {{ activeForm.gen }}</p>
              <p v-if="activeForm?.region" class="detail-extra"><strong>Region:</strong> {{ activeForm.region }}</p> -->
            </div>
          </div>
          
          <div class="collection-toggles" v-if="activeForm">
            <button 
              class="collect-btn" 
              :class="{ collected: isCollected(activeForm.id, false) }"
              @click="toggleCollection(activeForm.id, false)"
            >
              <span class="icon">&#9679;</span> Normal
            </button>
            <button 
              class="collect-btn shiny" 
              :class="{ collected: isCollected(activeForm.id, true) }"
              @click="toggleCollection(activeForm.id, true)"
            >
              <span class="icon">&#9733;</span> Shiny
            </button>
          </div>
        </div>

        <div class="detail-body">
          <div v-if="activeEvolutionChain.length" class="evolution-chain">
            <h3>Evolution Line</h3>
            <div class="evolution-list">
              <button
                v-for="evolution in activeEvolutionChain"
                :key="evolution.id"
                type="button"
                class="evolution-item"
                :class="{ current: evolution.isCurrent }"
                :title="evolution.isCurrent ? 'Currently viewing this Pokemon' : `View ${evolution.label}`"
                @click="selectEvolutionForm(evolution.id)"
              >
                <img
                  :src="getSpriteUrl(evolution.sprite, localShowShiny)"
                  :alt="evolution.label"
                  loading="lazy"
                />
                <span class="evolution-stage">Stage {{ evolution.stage }}</span>
                <strong>{{ evolution.label }}</strong>
              </button>
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
    </div>

    <div v-if="showFilterModal" class="filter-modal" @click.self="showFilterModal = false">
      <div class="filter-panel" role="dialog" aria-modal="true">
        <div class="filter-header">
          <h2>Filter Settings</h2>
          <button class="filter-close" aria-label="Close filters" @click="showFilterModal = false">&times;</button>
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

          <div class="filter-section">
            <h3>Special Forms</h3>
            <!-- Gigantamax Filter -->
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="excludeGigantamax"
                :disabled="showBaseFormOnly"
              />
              <span>Exclude Gigantamax</span>
            </label>
            <!-- Mega Filter -->
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="excludeMegas"
                :disabled="showBaseFormOnly"
              />
              <span>Exclude Megas</span>
            </label>
            <!-- Boxable Filter -->
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="showBoxableOnly"
              />
              <span>Show Only Boxable Forms</span>
            </label>
            <!-- All Forms Filter -->
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="showBaseFormOnly"
              />
              <span>Hide all forms</span>
            </label>
            <!-- Group forms Filter -->
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="groupForms"
              />
              <span>Group forms in carousel</span>
            </label>
          </div>

          <div class="filter-section">
            <h3>Collection Status</h3>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="showCollectedOnly" />
              <span>Show Collected Only</span>
            </label>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="showUncollectedOnly" />
              <span>Show Uncollected Only</span>
            </label>
          </div>

          <div class="filter-section">
            <h3>Sync Between Devices</h3>
            <p class="sync-copy">
              Export your collection and filters as a sync file, then import that file on another device.
            </p>
            <div class="sync-actions">
              <button type="button" class="btn-clear" @click="exportCollection">Export Sync File</button>
              <button type="button" class="btn-close" @click="importCollection">Import Sync File</button>
            </div>
            <input
              ref="importFile"
              type="file"
              accept="application/json"
              class="sync-input"
              @change="handleFileImport"
            />
            <p v-if="syncMessage" class="sync-message" :class="syncMessageType">{{ syncMessage }}</p>
          </div>
        </div>

        <div class="filter-footer">
          <button class="btn-clear" @click="clearFilters">Clear Filters</button>
          <button class="btn-close" @click="showFilterModal = false">Done</button>
        </div>
      </div>
    </div>

    <div v-if="!loading && !error && filteredPokemon.length === 0" class="no-results">
      <h3>No Pokemon found</h3>
      <p>Try adjusting your filters or search query.</p>
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
        <div class="pokemon-card_collection">
          <span
            class="collect-indicator"
            :class="{ active: isCollected(form.id, false) }"
            title="Normal Collected"
          >&#9679;</span>
          <span
            class="collect-indicator shiny"
            :class="{ active: isCollected(form.id, true) }"
            title="Shiny Collected"
          >&#9733;</span>
        </div>
        <div class="pokemon-card_image">
          <Transition name="sprite-fade" mode="out-in">
            <img :key="`${form.sprite || form.id}-${showShiny}`" :src="getSpriteUrl(form.sprite || form.id)" :alt="form.name" loading="lazy" />
          </Transition>
        </div>
        <div class="pokemon-card_info">
          <h2>{{ form.pokemonName }}</h2>
          <!-- <p>
            <span>{{ form.type1 || "Unknown" }}</span>
            <span v-if="form.type2"> / {{ form.type2 }}</span>
          </p> -->
          <div class="carousel-placeholder">
            <div class="pokemon-card_carousel" v-if="form.isGrouped && form.allFormsCount > 1">
              <button @click.stop="cycleForm(form.pokemonId, -1)" class="carousel-btn" aria-label="Previous form">&lsaquo;</button>
              <span class="carousel-dots">
                {{ form.currentFormIndex + 1 }} / {{ form.allFormsCount }}
              </span>
              <button @click.stop="cycleForm(form.pokemonId, 1)" class="carousel-btn" aria-label="Next form">&rsaquo;</button>
            </div>
          </div>
          <p v-if="!showBaseFormOnly" class="form-label">{{ form.name === form.pokemonName ? '·' : form.name }}</p>
        </div>
      </article>
    </div>

    <div v-if="!loading && !error" class="pagination">
      <div class="pagination-main">
        <button @click="firstPage" title="First Page" aria-label="First page">&laquo;</button>
        <button @click="prevPage" :disabled="page === 1" title="Previous Page" aria-label="Previous page">&lsaquo;</button>
        
        <span class="pagination-status">
          {{ page }} / {{ pageCount }}
        </span>
        
        <button @click="nextPage" :disabled="page === pageCount" title="Next Page" aria-label="Next page">&rsaquo;</button>
        <button @click="lastPage" title="Last Page" aria-label="Last page">&raquo;</button>
      </div>

      <div class="pagination-input">
        <label>
          Jump to
          <input
            type="number"
            v-model.number="pageDraft"
            min="1"
            :max="pageCount"
          />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.no-results {
  text-align: center;
  padding: 70px 24px;
  color: #a6a6a6;
}
.no-results h3 {
  margin-bottom: 8px;
}
.pokedex-view {
  padding: 10px;
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
    gap: 12px; /* Reduce vertical gap between page-meta-left and page-meta-right */
  }

  .page-meta-right {
    justify-content: flex-start;
    flex-wrap: wrap; /* Allow items to wrap onto the next line */
  }

  .filter-search,
  .page-size-selector {
    width: 100%;
  }

  .sync-actions {
    grid-template-columns: 1fr;
  }
}

.page-size-selector select option {
  color: #111;
  background: #fff;
}

.pokemon-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(6, minmax(180px, 1fr));
}

@media (max-width: 1480px) {
  .pokemon-grid {
    grid-template-columns: repeat(5, minmax(180px, 1fr));
  }
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
  overflow: hidden;
}

.detail-card {
  width: min(980px, 100%);
  max-height: calc(100vh - 48px);
  background: rgba(15, 15, 15, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  color: #f6f6f6;
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.35);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  flex-shrink: 0;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(20, 20, 20, 0.95);
  position: relative;
  z-index: 5;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 480px) {
  .pokemon-modal {
    padding: 10px;
  }
  .detail-card {
    max-height: calc(100vh - 20px);
  }
  .detail-header, .detail-body {
    padding: 16px;
  }
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
  margin-top: 0px;
}

.detail-forms-list h3 {
  margin: 0 0 12px;
}

.detail-forms-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.detail-forms-list li {
  display: block;
}

@media (max-width: 640px) {
  .detail-forms-list ul {
    grid-template-columns: 1fr;
  }
}

.detail-extra {
  margin-top: 16px;
}

.evolution-chain {
  margin-top: 0px;
  margin-bottom: 6px;
}

.evolution-chain h3 {
  margin: 0 0 10px;
  font-size: 1rem;
  color: #f0f0f0;
}

.evolution-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}

.evolution-item {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 10px 8px;
  width: 100%;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  color: inherit;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.evolution-item:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.evolution-item:focus-visible {
  outline: 2px solid rgba(255, 71, 71, 0.9);
  outline-offset: 2px;
}

.evolution-item.current {
  border-color: rgba(255, 71, 71, 0.7);
  background: rgba(255, 71, 71, 0.12);
}

.evolution-item img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  filter: drop-shadow(0px 0px 5px rgba(255, 255, 255, 0.45)) drop-shadow(1px 1px 0px rgb(0, 0, 0));
}

.evolution-stage {
  font-size: 0.78rem;
  color: #bdbdbd;
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

@media (max-width: 480px) {
  .form-option {
    padding: 10px 12px;
  }
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
  min-height: 120px;
}

.pokemon-card_image img {
  max-width: 100%;
  max-height: 120px;
}

.pokemon-card_info h2 {
  margin: 0px;
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  /* margin-top: 10px; */
  padding: 10px 0;
}

.pagination-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pagination-status {
  min-width: 90px;
  text-align: center;
  font-weight: 700;
  color: #fff;
  font-size: 1.1rem;
  letter-spacing: 0.05em;
}

.pagination-input {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: #a6a6a6;
}

.pagination-input label {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pagination-input input {
  width: 64px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  text-align: center;
  font-weight: 600;
}

.pagination button {
  border: none;
  background: #ff4747;
  color: white;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1;
}
.pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pagination button:hover {
  background: #ff5757;
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(255, 71, 71, 0.3);
}

.pagination button:active {
  transform: translateY(0);
}

@media (max-width: 480px) {
  .pagination-main {
    gap: 8px;
  }
  
  .pagination button {
    width: 40px;
    height: 40px;
    font-size: 1.3rem;
    border-radius: 12px;
  }

  .pagination-status {
    min-width: 80px;
    font-size: 1rem;
  }
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

.shiny-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #a6a6a6;
  font-size: 0.95rem;
  background: rgba(255, 255, 255, 0.08);
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
  user-select: none;
}

.shiny-toggle:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #eaeaea;
}

.switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255, 255, 255, 0.2);
  transition: .3s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 12px; width: 12px;
  left: 3px; bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

.switch input:checked + .slider {
  background-color: #ff4747;
}

.switch input:checked + .slider:before {
  transform: translateX(14px);
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

.sync-copy {
  color: #b7b7b7;
  line-height: 1.5;
}

.sync-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.sync-input {
  display: none;
}

.sync-message {
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.92rem;
}

.sync-message.success {
  background: rgba(122, 199, 76, 0.12);
  color: #bde7a6;
}

.sync-message.error {
  background: rgba(255, 107, 107, 0.12);
  color: #ffb3b3;
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

/* Sprite transition styles */
.sprite-fade-enter-active,
.sprite-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.sprite-fade-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.sprite-fade-leave-to {
  opacity: 0;
  transform: scale(1.1);
}

/* Collection styles */
.collection-toggles {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.collect-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: #a6a6a6;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
}

.collect-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.collect-btn.collected {
  background: rgba(255, 71, 71, 0.2);
  border-color: #ff4747;
  color: #fff;
}

.collect-btn.shiny.collected {
  background: rgba(247, 208, 44, 0.2);
  border-color: #f7d02c;
  color: #fff;
}

.pokemon-card_collection {
  position: absolute;
  bottom: 10px;
  right: 12px;
  display: flex;
  gap: 6px;
  z-index: 1;
}

.collect-indicator {
  font-size: 1rem;
  opacity: 0.15;
  transition: opacity 0.2s ease;
}

.collect-indicator.active {
  opacity: 1;
  color: #ff4747;
  text-shadow: 0 0 8px rgba(255, 71, 71, 0.6);
}

.collect-indicator.shiny.active {
  color: #f7d02c;
  text-shadow: 0 0 8px rgba(247, 208, 44, 0.6);
}

/* Carousel styles */
.carousel-placeholder {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pokemon-card_carousel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  width: 100%;
  padding: 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
}

.carousel-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: background 0.2s;
  line-height: 1;
}

.carousel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.carousel-dots {
  font-size: 0.75rem;
  color: #a6a6a6;
  min-width: 40px;
  text-align: center;
}
</style>

<style>
.no-scroll {
  overflow: hidden !important;
  color: red !important;
}
</style>
