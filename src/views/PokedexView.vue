<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  createSyncPayload,
  defaultCollectionFilters,
  loadPokedex,
  parseSyncPayload,
  readCollections,
  readSettings,
  writeCollections,
  writeSettings,
} from '@/lib/pokedex'
import type { CollectionFilters, NamedCollection, PokedexSettings, PokemonEntry, PokemonForm } from '@/types/pokedex'

const itemsPerPage = ref(10)
const pageSizeOptions = [5, 6, 10, 12, 18, 20, 24, 30, 50, 60, 100]
const page = ref(1)
const pageDraft = ref(1)
const filterQuery = ref('')
const randomOrder = ref(false)
const debouncedQuery = ref('')
const pokemonList = ref<PokemonEntry[]>([])
const showEvolutionChain = ref(true) // New ref to control evolution chain visibility
const showTypeMatchups = ref(true)
const showForms = ref(true)
const loading = ref(true)
const error = ref('')
const selectedPokemon = ref<PokemonEntry | null>(null)
const selectedForm = ref<PokemonForm | null>(null)
const localShowShiny = ref(false)
const showFilterModal = ref(false)

const selectedGenerations = ref<number[]>([])

//Special Forms
const excludeGigantamax = ref(false)
const showOnlyGigantamax = ref(false)

const excludeMegas = ref(false)
const showOnlyMegas = ref(false)

const excludeBoxable = ref(false)
const showBoxableOnly = ref(false)

const showBaseFormOnly = ref(false)
const excludeBaseForm = ref(false)

const groupForms = ref(false)

const showShiny = ref(false)

const PREDEFINED_TAGS = ['Favourite']

const collectedNormal = ref<string[]>([])
const collectedShiny = ref<string[]>([])
const pokemonTags = ref<Record<string, string[]>>({})
//Collection Status
const showCollectedOnly = ref(false)
const showUncollectedOnly = ref(false)
const selectedTags = ref<string[]>([])
const excludedTags = ref<string[]>([])
const showUntaggedOnly = ref(false)
const tagSearchQuery = ref('')
const tagDraft = ref('')

const importFile = ref<HTMLInputElement | null>(null)
const syncMessage = ref('')
const syncMessageType = ref<'success' | 'error' | ''>('')

const speciesActiveFormId = ref<Record<string, string>>({})

const allCollections = ref<NamedCollection[]>([])
const activeCollectionId = ref('default')
let isLoadingCollections = true

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

const typeEffectiveness: Record<string, Partial<Record<string, number>>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
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

const getTags = (id: string, isShiny: boolean) => {
  const key = `${id}-${isShiny ? 's' : 'n'}`
  return pokemonTags.value[key] ?? []
}

const normalizeTag = (value: string) => value.trim().replace(/\s+/g, ' ')

const allTags = computed(() => {
  const tags = new Set<string>(PREDEFINED_TAGS)
  Object.values(pokemonTags.value).forEach((formTags) => {
    formTags.forEach((tag) => tags.add(tag))
  })
  return Array.from(tags).sort((a, b) => a.localeCompare(b))
})

const filteredTags = computed(() => {
  const q = tagSearchQuery.value.toLowerCase().trim()
  if (!q) return allTags.value
  return allTags.value.filter(tag => tag.toLowerCase().includes(q))
})

const addTag = (id: string, value: string = tagDraft.value, isShiny: boolean = localShowShiny.value) => {
  const tag = normalizeTag(value)
  if (!tag) return

  const key = `${id}-${isShiny ? 's' : 'n'}`
  const currentTags = pokemonTags.value[key] ?? []
  if (!currentTags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
    pokemonTags.value = {
      ...pokemonTags.value,
      [key]: [...currentTags, tag].sort((a, b) => a.localeCompare(b)),
    }
    saveCollections()
  }
  tagDraft.value = ''
}

const removeTag = (id: string, tag: string, isShiny: boolean = localShowShiny.value) => {
  const key = `${id}-${isShiny ? 's' : 'n'}`
  const nextTags = (pokemonTags.value[key] ?? []).filter((item) => item !== tag)
  const nextTagMap = { ...pokemonTags.value }

  if (nextTags.length) {
    nextTagMap[key] = nextTags
  } else {
    delete nextTagMap[key]
  }

  pokemonTags.value = nextTagMap
  saveCollections()
}

const toggleTagFilter = (tag: string) => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
    const eIndex = excludedTags.value.indexOf(tag)
    if (eIndex > -1) excludedTags.value.splice(eIndex, 1)
  }
}

const toggleExcludedTagFilter = (tag: string) => {
  const index = excludedTags.value.indexOf(tag)
  if (index > -1) {
    excludedTags.value.splice(index, 1)
  } else {
    excludedTags.value.push(tag)
    const sIndex = selectedTags.value.indexOf(tag)
    if (sIndex > -1) selectedTags.value.splice(sIndex, 1)
  }
}

const toggleCollection = (id: string, isShiny: boolean) => {
  const list = isShiny ? collectedShiny.value : collectedNormal.value
  const index = list.indexOf(id)
  if (index > -1) {
    list.splice(index, 1)
  } else {
    list.push(id)
  }
  saveCollections()
  saveSettings()
}

const isFormExcluded = (form: PokemonForm & { isBaseForm?: boolean }): boolean => {
  const isGmax = form.form?.toLowerCase().includes('gigantamax') || form.form?.toLowerCase().includes('eternamax')
  const isMega = form.form?.toLowerCase().includes('mega') || form.form?.toLowerCase().includes('primal')

  if (excludeGigantamax.value && isGmax) return true
  if (showOnlyGigantamax.value && !isGmax) return true

  if (excludeMegas.value && isMega) return true
  if (showOnlyMegas.value && !isMega) return true

  if (excludeBoxable.value && form.boxable) return true
  if (showBoxableOnly.value && !form.boxable) return true

  if (showBaseFormOnly.value && !form.isBaseForm) return true
  if (excludeBaseForm.value && form.isBaseForm) return true

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
  const formTags = getTags(form.id, showShiny.value)

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

  if (!showUntaggedOnly.value && selectedTags.value.length > 0 && !selectedTags.value.some((tag) => formTags.includes(tag))) {
    return false
  }

  if (excludedTags.value.length > 0 && excludedTags.value.some((tag) => formTags.includes(tag))) {
    return false
  }

  if (showUntaggedOnly.value && formTags.length > 0 && selectedTags.value.length == 0) {
    return false
  }

  if (!query) return true

  const q = query.toLowerCase()
  const orParts = q.split(',').map(p => p.trim()).filter(p => p !== '')
  if (orParts.length === 0) return true

  return orParts.some(orPart => {
    const andParts = orPart.split('&').map(p => p.trim()).filter(p => p !== '')
    return andParts.every(term => {
      const isNegated = term.startsWith('!')
      const actualTerm = isNegated ? term.slice(1).trim() : term
      if (!actualTerm) return true

      const matches = (
        form.id.toLowerCase().includes(actualTerm) ||
        form.name.toLowerCase().includes(actualTerm) ||
        form.pokemonName.toLowerCase().includes(actualTerm) ||
        (form.type1?.toLowerCase() ?? '').includes(actualTerm) ||
        (form.type2?.toLowerCase() ?? '').includes(actualTerm) ||
        formTags.some(tag => tag.toLowerCase().includes(actualTerm))
      )
      return isNegated ? !matches : matches
    })
  })
}

const filteredPokemon = computed(() => {
  const query = debouncedQuery.value

  // Filter base forms list first
  let flatResults = allFormsFlat.value.filter((form) => isFormVisible(form, query))

  if (randomOrder.value) {
    // Shallow copy and randomize the order
    flatResults = [...flatResults].sort(() => Math.random() - 0.5)
  }

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

const saveCollections = () => {
  const index = allCollections.value.findIndex((c) => c.id === activeCollectionId.value)
  if (index !== -1 && allCollections.value[index]) {
    allCollections.value[index].state = {
      normal: [...collectedNormal.value],
      shiny: [...collectedShiny.value],
      tags: { ...pokemonTags.value },
    }
    allCollections.value[index].filters = getCurrentCollectionFilters()
  }
  writeCollections(allCollections.value)
}

const saveCollectionSnapshot = (id: string) => {
  const index = allCollections.value.findIndex((c) => c.id === id)
  if (index !== -1 && allCollections.value[index]) {
    allCollections.value[index].state = {
      normal: [...collectedNormal.value],
      shiny: [...collectedShiny.value],
      tags: { ...pokemonTags.value },
    }
    allCollections.value[index].filters = getCurrentCollectionFilters()
    writeCollections(allCollections.value)
  }
}

const loadCollectionSnapshot = (id: string) => {
  const collection = allCollections.value.find((c) => c.id === id)
  if (collection) {
    collectedNormal.value = [...collection.state.normal]
    collectedShiny.value = [...collection.state.shiny]
    pokemonTags.value = { ...collection.state.tags }
    applyCollectionFilters(collection.filters)
  }
}

const createNewCollection = () => {
  const name = prompt('Enter a name for the new collection:')
  if (!name) return
  saveCollectionSnapshot(activeCollectionId.value)

  const newId = String(Date.now())
  allCollections.value.push({
    id: newId,
    name: name,
    state: { normal: [], shiny: [], tags: {} },
    filters: { ...defaultCollectionFilters },
  })
  writeCollections(allCollections.value)
  activeCollectionId.value = newId

  saveSettings()
}

const renameCollection = (id: string) => {
  const collection = allCollections.value.find((c) => c.id === id)
  if (!collection) return
  const newName = prompt('Enter new name:', collection.name)
  if (newName && newName !== collection.name) {
    collection.name = newName
    saveCollections()
  }
}

const deleteCollection = (id: string) => {
  if (allCollections.value.length <= 1) return
  if (!confirm('Are you sure you want to delete this collection?')) return

  if (activeCollectionId.value !== id) {
    saveCollectionSnapshot(activeCollectionId.value)
  }

  allCollections.value = allCollections.value.filter((c) => c.id !== id)
  if (activeCollectionId.value === id && allCollections.value[0]) {
    activeCollectionId.value = allCollections.value[0].id
  }
  writeCollections(allCollections.value)
  saveSettings()
}

watch(
  activeCollectionId,
  (newId, oldId) => {
    if (!isLoadingCollections && oldId) {
      saveCollectionSnapshot(oldId)
    }
    loadCollectionSnapshot(newId)
  },
  { flush: 'sync' },
)

const getCurrentCollectionFilters = (): CollectionFilters => ({
  filterQuery: filterQuery.value,
  randomOrder: randomOrder.value,
  showShiny: showShiny.value,
  itemsPerPage: itemsPerPage.value,
  selectedGenerations: selectedGenerations.value,
  excludeGigantamax: excludeGigantamax.value,
  showOnlyGigantamax: showOnlyGigantamax.value,
  excludeMegas: excludeMegas.value,
  showOnlyMegas: showOnlyMegas.value,
  excludeBoxable: excludeBoxable.value,
  showBoxableOnly: showBoxableOnly.value,
  showBaseFormOnly: showBaseFormOnly.value,
  excludeBaseForm: excludeBaseForm.value,
  groupForms: groupForms.value,
  showEvolutionChain: showEvolutionChain.value,
  showTypeMatchups: showTypeMatchups.value,
  showForms: showForms.value,
  showCollectedOnly: showCollectedOnly.value,
  showUncollectedOnly: showUncollectedOnly.value,
  selectedTags: selectedTags.value.filter((tag) => allTags.value.includes(tag)),
  excludedTags: excludedTags.value.filter((tag) => allTags.value.includes(tag)),
  showUntaggedOnly: showUntaggedOnly.value,
})

const getCurrentSettings = (): PokedexSettings => ({
  ...getCurrentCollectionFilters(),
  activeCollectionId: activeCollectionId.value,
})

const applyCollectionFilters = (filters: CollectionFilters) => {
  filterQuery.value = filters.filterQuery
  debouncedQuery.value = filters.filterQuery
  randomOrder.value = filters.randomOrder
  showShiny.value = filters.showShiny
  itemsPerPage.value = filters.itemsPerPage
  selectedGenerations.value = [...filters.selectedGenerations]
  excludeGigantamax.value = filters.excludeGigantamax
  showOnlyGigantamax.value = filters.showOnlyGigantamax
  excludeMegas.value = filters.excludeMegas
  showOnlyMegas.value = filters.showOnlyMegas
  excludeBoxable.value = filters.excludeBoxable
  showBoxableOnly.value = filters.showBoxableOnly
  showBaseFormOnly.value = filters.showBaseFormOnly
  excludeBaseForm.value = filters.excludeBaseForm
  groupForms.value = filters.groupForms
  showEvolutionChain.value = filters.showEvolutionChain
  showTypeMatchups.value = filters.showTypeMatchups
  showForms.value = filters.showForms
  showCollectedOnly.value = filters.showCollectedOnly
  showUncollectedOnly.value = filters.showUncollectedOnly
  selectedTags.value = filters.selectedTags.filter((tag) => allTags.value.includes(tag))
  excludedTags.value = filters.excludedTags?.filter((tag) => allTags.value.includes(tag)) ?? []
  showUntaggedOnly.value = filters.showUntaggedOnly
}

const applySettings = (settings: PokedexSettings) => {
  activeCollectionId.value = settings.activeCollectionId
  applyCollectionFilters(settings)
}

const saveSettings = () => {
  writeSettings(getCurrentSettings())
}

watch(showCollectedOnly, (newVal) => { if (newVal) showUncollectedOnly.value = false })
watch(showUncollectedOnly, (newVal) => { if (newVal) showCollectedOnly.value = false })
//watch(showUntaggedOnly, (newVal) => { if (newVal) selectedTags.value = [] })
//watch(selectedTags, (newVal) => { if (newVal.length > 0) showUntaggedOnly.value = false }, { deep: true })
watch(allTags, (tags) => {
  const nextSelected = selectedTags.value.filter((tag) => tags.includes(tag))
  if (nextSelected.length !== selectedTags.value.length) {
    selectedTags.value = nextSelected
  }

  const nextExcluded = excludedTags.value.filter((tag) => tags.includes(tag))
  if (nextExcluded.length !== excludedTags.value.length) {
    excludedTags.value = nextExcluded
  }
})

// Mutual exclusion for Special Forms
watch(showBaseFormOnly, (val) => { if (val) {excludeBaseForm.value = false; excludeGigantamax.value = false; showOnlyGigantamax.value = false; excludeMegas.value = false; showOnlyMegas.value = false} })
watch(excludeBaseForm, (val) => { if (val) {showBaseFormOnly.value = false} })

watch(excludeGigantamax, (val) => { if (val) {showOnlyGigantamax.value = false; showOnlyMegas.value = false} })
watch(showOnlyGigantamax, (val) => { if (val) {excludeGigantamax.value = false; excludeMegas.value = false; showOnlyMegas.value = false} })
watch(excludeMegas, (val) => { if (val) {showOnlyMegas.value = false; showOnlyGigantamax.value = false} })
watch(showOnlyMegas, (val) => { if (val) {excludeMegas.value = false; excludeGigantamax.value = false; showOnlyGigantamax.value = false} })

watch(excludeBoxable, (val) => { if (val) {showBoxableOnly.value = false} })
watch(showBoxableOnly, (val) => { if (val) {excludeBoxable.value = false} })

watch([showEvolutionChain, showTypeMatchups, showForms], () => {
  saveSettings()
  if (!isLoadingCollections) {
    saveCollectionSnapshot(activeCollectionId.value)
  }
})

watch(
  [selectedGenerations, excludeGigantamax, showOnlyGigantamax, excludeMegas, showOnlyMegas, excludeBoxable, showBoxableOnly, showBaseFormOnly, excludeBaseForm, filterQuery, randomOrder, itemsPerPage, showCollectedOnly, showUncollectedOnly, selectedTags, excludedTags, showUntaggedOnly, groupForms, activeCollectionId],
  () => {
    page.value = 1
    pageDraft.value = 1
    saveSettings()
    if (!isLoadingCollections) {
      saveCollectionSnapshot(activeCollectionId.value)
    }
  },
  { deep: true }
)

watch(showShiny, () => {
  if(showCollectedOnly.value == true || showUncollectedOnly.value == true) {
    page.value = 1
    pageDraft.value = 1
  }
  saveSettings()
  if (!isLoadingCollections) {
    saveCollectionSnapshot(activeCollectionId.value)
  }
})

watch([collectedNormal, collectedShiny, pokemonTags], () => {
  saveCollections()
}, { deep: true })

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

const detailNavigationItems = computed(() => {
  if (groupForms.value) {
    return (filteredPokemon.value as PokemonEntry[]).map((pokemon) => {
      const visibleForms = pokemon.forms
        .map((form, index) => ({
          ...form,
          pokemonName: pokemon.name,
          pokemonId: pokemon.id,
          isBaseForm: index === 0,
        }))
        .filter((form) => isFormVisible(form, debouncedQuery.value))
      const activeFormId = speciesActiveFormId.value[pokemon.id]
      const form = visibleForms.find((item) => item.id === activeFormId) ?? visibleForms[0]

      return {
        pokemonId: pokemon.id,
        formId: form?.id ?? pokemon.forms[0]?.id ?? pokemon.id,
      }
    })
  }

  return (filteredPokemon.value as Array<PokemonForm & { pokemonId: string }>).map((form) => ({
    pokemonId: form.pokemonId,
    formId: form.id,
  }))
})

/* const currentRange = computed(() => {
  const start = filteredPokemon.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1
  const end = Math.min(page.value * itemsPerPage.value, filteredPokemon.value.length)
  return `${start}-${end}`
}) */

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

const activeDetailIndex = computed(() => {
  if (!selectedPokemon.value) return -1

  const activeId = activeForm.value?.id

  return detailNavigationItems.value.findIndex((item) => {
    if (groupForms.value) {
      return item.pokemonId === selectedPokemon.value?.id
    }

    return item.pokemonId === selectedPokemon.value?.id && item.formId === activeId
  })
})

const activeGenderIcons = computed(() => {
  return getGenderIcons(activeForm.value?.gender ?? null)
})

const pokemonTypes = computed(() => {
  const types = [activeForm.value?.type1, activeForm.value?.type2].filter((type): type is string => Boolean(type))
  return [...new Set(types)]
})

const matchupTypes = Object.keys(type_colors)

const getTypeMultiplier = (attackType: string, defenseType: string) => {
  return typeEffectiveness[attackType]?.[defenseType] ?? 1
}

const formatMultiplier = (value: number) => `${value}x`

const sortMatchups = (left: { multiplier: number; type: string }, right: { multiplier: number; type: string }) => {
  if (right.multiplier !== left.multiplier) return right.multiplier - left.multiplier
  return left.type.localeCompare(right.type)
}

const attackingStrongAgainst = computed(() => {
  if (pokemonTypes.value.length === 0) return []

  return matchupTypes
    .map((type) => ({
      type,
      multiplier: Math.max(...pokemonTypes.value.map((pokemonType) => getTypeMultiplier(pokemonType, type))),
    }))
    .filter((matchup) => matchup.multiplier > 1)
    .sort(sortMatchups)
})

const defensiveTypeMatchups = computed(() => {
  if (pokemonTypes.value.length === 0) return []

  return matchupTypes
    .map((type) => ({
      type,
      multiplier: pokemonTypes.value.reduce(
        (total, pokemonType) => total * getTypeMultiplier(type, pokemonType),
        1,
      ),
    }))
    .sort(sortMatchups)
})

const defensiveWeaknesses = computed(() => defensiveTypeMatchups.value.filter((matchup) => matchup.multiplier > 1))
const defensiveResistances = computed(() => defensiveTypeMatchups.value.filter((matchup) => matchup.multiplier > 0 && matchup.multiplier < 1))
const defensiveImmunities = computed(() => defensiveTypeMatchups.value.filter((matchup) => matchup.multiplier === 0))

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

const groupedEvolutionChain = computed(() => {
  const chain = activeEvolutionChain.value
  const groups: Record<number, typeof chain> = {}

  chain.forEach((item) => {
    if (!groups[item.stage]) {
      groups[item.stage] = []
    }
    groups[item.stage]?.push(item)
  })

  return Object.keys(groups)
    .sort((a, b) => Number(a) - Number(b))
    .map((stage) => ({
      stage: Number(stage),
      pokemon: groups[Number(stage)],
    }))
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
  tagDraft.value = ''
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

const navigateDetail = (direction: number) => {
  if (detailNavigationItems.value.length <= 1) return

  const currentIndex = activeDetailIndex.value === -1 ? 0 : activeDetailIndex.value
  const nextIndex = (currentIndex + direction + detailNavigationItems.value.length) % detailNavigationItems.value.length
  const nextItem = detailNavigationItems.value[nextIndex]

  if (!nextItem) return

  const pokemon = pokemonList.value.find((entry) => entry.id === nextItem.pokemonId)
  if (!pokemon) return

  const form = pokemon.forms.find((item) => item.id === nextItem.formId) ?? pokemon.forms[0] ?? null

  selectedPokemon.value = pokemon
  selectedForm.value = form
  if (groupForms.value && form) {
    speciesActiveFormId.value[pokemon.id] = form.id
  }

  page.value = Math.floor(nextIndex / itemsPerPage.value) + 1
  pageDraft.value = page.value
}

const closeDetail = () => {
  selectedPokemon.value = null
  selectedForm.value = null
  tagDraft.value = ''
}

/* const toggleGenerationFilter = (gen: number) => {
  const index = selectedGenerations.value.indexOf(gen)
  if (index > -1) {
    selectedGenerations.value.splice(index, 1)
  } else {
    selectedGenerations.value.push(gen)
  }
  page.value = 1
  pageDraft.value = 1
} */

/* const isGenerationSelected = (gen: number) => {
  return selectedGenerations.value.includes(gen)
} */

const clearFilters = () => {
  applyCollectionFilters(defaultCollectionFilters)
}

const setSyncMessage = (message: string, type: 'success' | 'error') => {
  syncMessage.value = message
  syncMessageType.value = type
}

const exportCollection = () => {
  saveCollectionSnapshot(activeCollectionId.value)

  const payload = createSyncPayload(allCollections.value, getCurrentSettings())

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStamp = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `pokedex-sync-${dateStamp}.json`
  link.click()
  URL.revokeObjectURL(url)

  setSyncMessage('Sync file downloaded. Import it on your other device to restore your collections.', 'success')
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
    const importedCollections = payload.collections.length
      ? payload.collections
      : [
          {
            id: payload.settings.activeCollectionId,
            name: 'Main Collection',
            state: payload.collection ?? { normal: [], shiny: [], tags: {} },
            filters: defaultCollectionFilters,
          },
        ]
    const active = importedCollections.find((collection) => collection.id === payload.settings.activeCollectionId)
      ?? importedCollections[0]

    isLoadingCollections = true
    allCollections.value = importedCollections

    if (active) {
      activeCollectionId.value = active.id
      loadCollectionSnapshot(active.id)
      applySettings({
        ...payload.settings,
        activeCollectionId: active.id,
      })
    } else {
      applyCollectionFilters(defaultCollectionFilters)
      collectedNormal.value = []
      collectedShiny.value = []
      pokemonTags.value = {}
    }
    page.value = 1
    pageDraft.value = 1

    isLoadingCollections = false
    saveCollections()
    saveSettings()

    setSyncMessage(`Imported ${importedCollections.length} collection${importedCollections.length === 1 ? '' : 's'} from ${new Date(payload.exportedAt).toLocaleString()}.`, 'success')
  } catch (err) {
    isLoadingCollections = false
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
  if (event.key === 'ArrowLeft' && selectedPokemon.value) {
    navigateDetail(-1)
  }
  if (event.key === 'ArrowRight' && selectedPokemon.value) {
    navigateDetail(1)
  }
  if (event.key === 'Escape' && showFilterModal.value) {
    showFilterModal.value = false
  }
}

onMounted(async () => {
  await loadPokedexData()

  allCollections.value = readCollections()

  // Migration for separate normal/shiny tags
  allCollections.value.forEach(col => {
    const tags = col.state.tags
    Object.keys(tags).forEach(key => {
      if (!key.endsWith('-n') && !key.endsWith('-s')) {
        const value = tags[key]
        if (value && value.length > 0) {
          if (!tags[`${key}-n`]) tags[`${key}-n`] = [...value]
          if (!tags[`${key}-s`]) tags[`${key}-s`] = [...value]
        }
        delete tags[key]
      }
    })
  })
  writeCollections(allCollections.value)

  const settings = readSettings()
  const active = allCollections.value.find(c => c.id === settings.activeCollectionId) || allCollections.value[0]

  if (active) {
    activeCollectionId.value = active.id
    loadCollectionSnapshot(active.id)
  } else {
    applyCollectionFilters(defaultCollectionFilters)
  }
  isLoadingCollections = false

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
    <div class="page-meta-header">
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
              placeholder="Search by Name, Type, Tag"
              aria-label="Filter Pokemon. Use , for OR, & for AND, and ! for NOT."
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

          <button v-if="!loading && !error" class="filter-btn" @click="showFilterModal = true" title="Open settings">
            Settings
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
        <button
          v-if="detailNavigationItems.length > 1"
          type="button"
          class="detail-nav detail-nav-prev"
          aria-label="Previous Pokemon"
          @click="navigateDetail(-1)"
        >
          &#8249;
        </button>
        <button
          v-if="detailNavigationItems.length > 1"
          type="button"
          class="detail-nav detail-nav-next"
          aria-label="Next Pokemon"
          @click="navigateDetail(1)"
        >
          &#8250;
        </button>
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
              <div class="pokemon-card_badge">#{{ selectedPokemon.id }}</div>
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

          <div class="tag-editor" v-if="activeForm">
            <div class="tag-list">
              <button
                v-for="tag in getTags(activeForm.id, localShowShiny)"
                :key="tag"
                type="button"
                class="tag-chip removable"
                :title="`Remove ${tag}`"
                @click="removeTag(activeForm.id, tag, localShowShiny)"
              >
                {{ tag }} <span aria-hidden="true">&times;</span>
              </button>
              <span v-if="getTags(activeForm.id, localShowShiny).length === 0" class="tag-empty">No tags</span>
            </div>
            <form class="tag-form" @submit.prevent="addTag(activeForm.id)">
              <input
                v-model="tagDraft"
                type="text"
                placeholder="Add tag"
                aria-label="Add tag"
                maxlength="32"
                list="existing-tags"
              />
              <datalist id="existing-tags">
                <option v-for="tag in allTags" :key="tag" :value="tag" />
              </datalist>
              <button type="submit">Add</button>
            </form>
          </div>
        </div>

        <div class="detail-body">
          <div class="evolution-chain-container">
            <button class="evolution-chain-toggle" @click="showEvolutionChain = !showEvolutionChain">
              <h3>Evolution Line</h3>
              <span class="toggle-arrow">{{ showEvolutionChain ? '&#x25BC;' : '&#x25B6;' }}</span>
            </button>
            <div v-if="groupedEvolutionChain.length && showEvolutionChain" class="evolution-list">
              <template v-for="(group, gIndex) in groupedEvolutionChain" :key="group.stage">
                <div v-if="gIndex > 0" class="evolution-arrow" aria-hidden="true">
                  <span class="arrow-horizontal">→</span>
                  <span class="arrow-vertical">↓</span>
                </div>
                <div class="evolution-stage-group">
                  <button
                    v-for="evolution in group.pokemon"
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
              </template>
            </div>
          </div>

          <div v-if="activeForm" class="type-matchups-container">
            <button class="evolution-chain-toggle" @click="showTypeMatchups = !showTypeMatchups">
              <h3>Type Matchups</h3>
              <span class="toggle-arrow">{{ showTypeMatchups ? '&#x25BC;' : '&#x25B6;' }}</span>
            </button>
            <div v-if="showTypeMatchups" class="type-matchups">
              <div class="matchup-group">
                <h4>Weaknesses</h4>
                <div class="matchup-pills">
                  <span
                    v-for="matchup in defensiveWeaknesses"
                    :key="`weak-${matchup.type}`"
                    class="matchup-pill"
                    :style="{ background: type_colors[matchup.type] || 'rgba(255,255,255,0.18)', color: '#111' }"
                  >
                    {{ matchup.type }} {{ formatMultiplier(matchup.multiplier) }}
                  </span>
                  <span v-if="defensiveWeaknesses.length === 0" class="matchup-empty">None</span>
                </div>
              </div>

              <div class="matchup-group">
                <h4>Resistances</h4>
                <div class="matchup-pills">
                  <span
                    v-for="matchup in defensiveResistances"
                    :key="`resist-${matchup.type}`"
                    class="matchup-pill"
                    :style="{ background: type_colors[matchup.type] || 'rgba(255,255,255,0.18)', color: '#111' }"
                  >
                    {{ matchup.type }} {{ formatMultiplier(matchup.multiplier) }}
                  </span>
                  <span v-if="defensiveResistances.length === 0" class="matchup-empty">None</span>
                </div>
              </div>

              <div class="matchup-group">
                <h4>Immunities</h4>
                <div class="matchup-pills">
                  <span
                    v-for="matchup in defensiveImmunities"
                    :key="`immune-${matchup.type}`"
                    class="matchup-pill"
                    :style="{ background: type_colors[matchup.type] || 'rgba(255,255,255,0.18)', color: '#111' }"
                  >
                    {{ matchup.type }}
                  </span>
                  <span v-if="defensiveImmunities.length === 0" class="matchup-empty">None</span>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-forms-list">
            <button class="evolution-chain-toggle" @click="showForms = !showForms">
              <h3>Forms</h3>
              <span class="toggle-arrow">{{ showForms ? '&#x25BC;' : '&#x25B6;' }}</span>
            </button>
            <ul v-if="showForms">
              <li v-for="form in selectedPokemon.forms" :key="form.id" class="form-item">
                <article 
                  class="pokemon-card small" 
                  :class="{ active: activeForm?.id === form.id }"
                  @click="selectForm(form)"
                  :style="{ background: form.type2
                    ? `linear-gradient(to right, ${type_colors[form.type1] || 'rgba(255,255,255,0.08)'} 0%, ${type_colors[form.type1] || 'rgba(255,255,255,0.08)'} 50%, ${type_colors[form.type2] || 'rgba(255,255,255,0.08)'} 50%, ${type_colors[form.type2] || 'rgba(255,255,255,0.08)'} 100%)`
                    : type_colors[form.type1] || 'rgba(255,255,255,0.08)' }"
                >
                  <div class="pokemon-card_badge">#{{ selectedPokemon.id }}</div>
                  <div class="pokemon-card_gender" v-if="getGenderIcons(form.gender).length">
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
                    >&#9679;</span>
                    <span
                      class="collect-indicator shiny"
                      :class="{ active: isCollected(form.id, true) }"
                    >&#9733;</span>
                  </div>
                  <div class="pokemon-card_image">
                    <img :src="getSpriteUrl(form.sprite || form.id, localShowShiny)" :alt="form.name" loading="lazy" />
                  </div>
                  <div class="pokemon-card_info">
                    <p class="form-label">{{ form.name }}</p>
                    <div v-if="getTags(form.id, localShowShiny).length" class="pokemon-card_tags">
                      <span v-for="tag in getTags(form.id, localShowShiny).slice(0, 3)" :key="tag" class="tag-chip">{{ tag }}</span>
                    </div>
                  </div>
                </article>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showFilterModal" class="filter-modal" @click.self="showFilterModal = false">
      <div class="filter-panel" role="dialog" aria-modal="true">
        <div class="filter-header">
          <h2>Filters & Settings</h2>
          <button class="filter-close" aria-label="Close filters" @click="showFilterModal = false">&times;</button>
        </div>

        <div class="filter-content">
          <!-- Generation Filter -->
          <div class="filter-section">
            <h3>Collection Management</h3>
            <div class="collection-manager">
              <select v-model="activeCollectionId" class="collection-select">
                <option v-for="col in allCollections" :key="col.id" :value="col.id">
                  {{ col.name }}
                </option>
              </select>
              <div class="collection-manager-actions">
                <button type="button" class="btn-manage" @click="createNewCollection">New</button>
                <button type="button" class="btn-manage" @click="renameCollection(activeCollectionId)">Rename</button>
                <button 
                  type="button" 
                  class="btn-manage" 
                  @click="deleteCollection(activeCollectionId)" 
                  :disabled="allCollections.length <= 1"
                >Delete</button>
              </div>
            </div>
          </div>

          <!-- <div class="filter-section">
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
          </div> -->

          <div class="filter-section">
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="groupForms"
              />
              <span>Group forms in carousel</span>
            </label>
            <label class="filter-checkbox">
              <input
                type="checkbox"
                v-model="randomOrder"
              />
              <span>Randomize Pokémon Order</span>
            </label>
            <h3>Special Forms</h3>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="showBaseFormOnly" />
              <span>Hide All Forms</span>
            </label>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="excludeBaseForm" />
              <span>Show Only Extra Forms</span>
            </label>

            <label class="filter-checkbox">
              <input type="checkbox" v-model="excludeGigantamax" :disabled="showBaseFormOnly" />
              <span>Exclude Gigantamax</span>
            </label>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="showOnlyGigantamax" :disabled="showBaseFormOnly" />
              <span>Show Only Gigantamax</span>
            </label>

            <label class="filter-checkbox">
              <input type="checkbox" v-model="excludeMegas" :disabled="showBaseFormOnly" />
              <span>Exclude Megas</span>
            </label>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="showOnlyMegas" :disabled="showBaseFormOnly" />
              <span>Show Only Megas</span>
            </label>

            <h3>Boxable</h3>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="excludeBoxable" />
              <span>Exclude Boxable Forms</span>
            </label>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="showBoxableOnly" />
              <span>Show Only Boxable Forms</span>
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
            <h3>Tags</h3>
            <label class="filter-checkbox">
              <input type="checkbox" v-model="showUntaggedOnly" />
              <span>Show Untagged Only</span>
            </label>
            <div v-if="allTags.length" class="tag-filter-container">
              <div class="tag-filter-header-actions">
                <input
                  v-model="tagSearchQuery"
                  type="text"
                  placeholder="Search tags..."
                  class="tag-search-input"
                />
                <!-- <button 
                  v-if="selectedTags.length > 0 || excludedTags.length > 0" 
                  @click="selectedTags = []; excludedTags = []" 
                  class="btn-tag-action"
                >Clear Selected</button> -->
              </div>
              <div class="filter-options tag-filter-options">
                <div v-for="tag in filteredTags" :key="tag" class="tag-filter-row">
                  <div class="tag-filter-controls">
                    <label class="filter-checkbox include" title="Include tag">
                      <input
                        type="checkbox"
                        :checked="selectedTags.includes(tag)"
                        @change="toggleTagFilter(tag)"
                      />
                      <span class="checkbox-label">Inc.</span>
                    </label>
                    <label class="filter-checkbox exclude" title="Exclude tag">
                      <input
                        type="checkbox"
                        :checked="excludedTags.includes(tag)"
                        @change="toggleExcludedTagFilter(tag)"
                      />
                      <span class="checkbox-label">Exc.</span>
                    </label>
                  </div>
                  <span class="tag-name" :class="{ 'is-excluded': excludedTags.includes(tag) }"><strong>{{ tag }}</strong></span>
                </div>
                <p v-if="filteredTags.length === 0" class="tag-empty-msg">No matching tags</p>
              </div>
            </div>
            <p v-else class="sync-copy">Add tags from a Pokemon detail view to filter by them here.</p>
          </div>

          <div class="filter-section">
            <h3>Sync Between Devices</h3>
            <p class="sync-copy">
              Export your collection and filters as a sync file, then import that file on another device.
            </p>
            <div class="sync-actions">
              <button type="button" class="btn-export" @click="exportCollection">Export File</button>
              <button type="button" class="btn-import" @click="importCollection">Import File</button>
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
          <div v-if="getTags(form.id, showShiny).length" class="pokemon-card_tags">
            <span v-for="tag in getTags(form.id, showShiny).slice(0, 3)" :key="tag" class="tag-chip">{{ tag }}</span>
          </div>
        </div>
      </article>
    </div>

    <div v-if="!loading && !error" class="pagination">
      <div class="pagination-main">
        <button @click="firstPage" :disabled="page === 1" title="First Page" aria-label="First page">&laquo;</button>
        <button @click="prevPage" :disabled="page === 1" title="Previous Page" aria-label="Previous page">&lsaquo;</button>
        
        <span class="pagination-status">
          {{ page }} / {{ pageCount }}
        </span>
        
        <button @click="nextPage" :disabled="page === pageCount" title="Next Page" aria-label="Next page">&rsaquo;</button>
        <button @click="lastPage" :disabled="page === pageCount" title="Last Page" aria-label="Last page">&raquo;</button>
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
  margin-bottom: 10px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: clamp(2rem, 2.4vw, 2.6rem);
}

.page-header p {
  margin: 0;
  color: #b8b8b8;
}

.page-meta-header {
  margin-bottom: 10px;
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
  width: 65px;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
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
  /* transform: translateY(-3px); */
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

.detail-nav {
  position: absolute;
  top: 150px;
  z-index: 20;
  width: 44px;
  height: 56px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(15, 15, 15, 0.78);
  color: #fff;
  cursor: pointer;
  font-size: 2.4rem;
  line-height: 1;
  display: grid;
  place-items: center;
  transform: translateY(-50%);
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  padding: 2px 0px 6px 0px;
}

.detail-nav:hover {
  border-color: rgba(255, 255, 255, 0.34);
  background: rgba(255, 71, 71, 0.9);
}

.detail-nav-prev {
  left: 0;
  border-radius: 0 14px 14px 0;
}

.detail-nav-next {
  right: 0;
  border-radius: 14px 0 0 14px;
}

.detail-nav-prev:hover {
  transform: translateY(-50%) translateX(-2px);
}

.detail-nav-next:hover {
  transform: translateY(-50%) translateX(2px);
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

  .detail-nav {
    width: 38px;
    height: 48px;
    font-size: 2rem;
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
  justify-content: center;
  text-align: center;
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
  justify-content: center;
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
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.detail-forms-list li {
  display: block;
}

.pokemon-card.active {
  outline: 3px solid #ff4747;
  outline-offset: 2px;
}

.pokemon-card.small {
  padding: 8px;
}

.pokemon-card.small .pokemon-card_image img {
  max-height: 80px;
}

@media (max-width: 640px) {
  .detail-forms-list ul {
    grid-template-columns: 1fr;
  }
}

.detail-extra {
  margin-top: 16px;
}

/* .toggle-arrow {
  font-size: 1.2rem;
  transition: transform 0.2s ease;
} */

.toggle-evolution-btn {
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.evolution-chain-toggle {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  gap: 10px;
}

.evolution-chain-toggle h3 {
  margin: 0;
  font-size: 1rem;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 0;
}

.evolution-stage-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.evolution-item {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 10px 8px;
  min-width: 110px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  color: inherit;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.evolution-item:hover {
  /* transform: translateY(-2px); */
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

.evolution-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.25);
  font-size: 1.6rem;
  font-weight: bold;
  user-select: none;
  flex-shrink: 0;
}

.evolution-arrow .arrow-vertical {
  display: none;
}

@media (max-width: 640px) {
  .evolution-list {
    flex-direction: column;
  }

  .evolution-arrow .arrow-horizontal {
    display: none;
  }

  .evolution-arrow .arrow-vertical {
    display: block;
  }

  .evolution-stage-group {
    width: 100%;
  }
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

.type-matchups-container {
  margin-top: 8px;
}

.type-matchups {
  display: grid;
  gap: 14px;
  padding: 8px 0 16px;
}

.matchup-group {
  display: grid;
  gap: 8px;
}

.matchup-group h4 {
  margin: 0;
  color: #f0f0f0;
  font-size: 0.92rem;
}

.matchup-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.matchup-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #111;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18), 0 4px 10px rgba(0, 0, 0, 0.16);
}

.matchup-empty {
  color: #9a9a9a;
  font-size: 0.9rem;
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


.pagination-main button {
  user-select: none;
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
  /* transform: translateY(-2px); */
  box-shadow: 0 6px 15px rgba(255, 71, 71, 0.3);
}

/* .pagination button:active {
  transform: translateY(0);
} */

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
  padding: 10px 24px;
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
  padding: 10px 24px;
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

.tag-filter-container {
  display: grid;
  gap: 6px;
  margin-top: 4px;
}

.tag-filter-header-actions {
  display: flex;
  gap: 6px;
}

.tag-search-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  padding: 6px 10px;
  color: #fff;
  font-size: 0.85rem;
}

.btn-tag-action {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #d1d1d1;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.75rem;
  white-space: nowrap;
}

.tag-filter-options {
  max-height: 200px;
  overflow: auto;
  padding-right: 4px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.15);
}

.tag-empty-msg {
  color: #777;
  font-size: 0.85rem;
  text-align: center;
  padding: 10px;
}

.checkbox-label {
  font-size: 0.75rem;
  font-weight: 600;
  /* Inherits color from .filter-checkbox by default */
  margin-left: -5px; /* Pull it closer to the checkbox */
  transition: color 0.2s ease;
}

.filter-checkbox.include input[type="checkbox"] {
  accent-color: #7ac74c; /* Green for include */
}

.filter-checkbox.exclude input[type="checkbox"] {
  accent-color: #ff6b6b; /* Red for exclude */
}

.filter-checkbox.include input:checked + .checkbox-label {
  color: #7ac74c;
}
.filter-checkbox.exclude input:checked + .checkbox-label {
  color: #ff6b6b;
}

.tag-filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.tag-filter-row:last-child {
  border-bottom: none;
}

.tag-filter-controls {
  display: flex;
  gap: 8px;
}

.tag-name {
  font-size: 0.9rem;
  color: #d1d1d1;
  transition: color 0.2s ease;
}

.tag-name.is-excluded {
  text-decoration: line-through;
  color: #ff6b6b;
}

.filter-checkbox.exclude input {
  accent-color: #ff6b6b;
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

.btn-export,
.btn-import {
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s ease;
}

.btn-export {
  background: #0066ff84;
  color: white;
  flex: 1;
  border: 1px white;
}

.btn-export:hover {
  background: #0066ff94;
}

.btn-import {
  background: #00ff6a84;
  color: white;
  flex: 1;
  border: 1px white;
}

.btn-import:hover {
  background: #00ff6a94;
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

.tag-editor {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.tag-list,
.pokemon-card_tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.tag-chip {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
  padding: 3px 8px;
  font-size: 0.74rem;
  line-height: 1.2;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.tag-chip.removable {
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.tag-chip.removable:hover {
  background: rgba(255, 71, 71, 0.22);
  border-color: rgba(255, 71, 71, 0.8);
}

.tag-empty {
  color: #a6a6a6;
  font-size: 0.85rem;
}

.tag-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.tag-form input {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 9px 10px;
}

.tag-form input::placeholder {
  color: #9f9f9f;
}

.tag-form button {
  border: none;
  border-radius: 8px;
  background: #ff4747;
  color: #fff;
  padding: 9px 12px;
  cursor: pointer;
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

.pokemon-card_tags {
  margin-top: 6px;
  min-height: 20px;
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

@media (max-width: 520px) {
  .pokedex-view {
    padding: 8px;
  }

  .pokemon-card {
    border-radius: 12px;
    padding: 7px;
  }

  .pokemon-card_badge {
    top: 7px;
    left: 7px;
    font-size: 0.68rem;
  }

  .pokemon-card_gender {
    top: 7px;
    right: 7px;
    gap: 3px;
  }

  .pokemon-card_gender img {
    width: 16px;
    height: 16px;
    padding: 2px;
  }

  .pokemon-card_collection {
    right: 8px;
    bottom: 7px;
    gap: 4px;
  }

  .collect-indicator {
    font-size: 0.8rem;
  }

  .pokemon-card_image {
    min-height: 82px;
  }

  .pokemon-card_image img {
    max-height: 82px;
  }

  .pokemon-card_info h2 {
    font-size: 0.9rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .carousel-placeholder {
    min-height: 24px;
  }

  .pokemon-card_carousel {
    gap: 4px;
    padding: 2px;
    border-radius: 7px;
  }

  .carousel-btn {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    font-size: 1rem;
  }

  .carousel-dots {
    min-width: 32px;
    font-size: 0.68rem;
  }

  .form-label {
    margin-top: 3px;
    font-size: 0.74rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .pokemon-card_tags {
    margin-top: 4px;
    min-height: 0;
    gap: 4px;
  }

  .pokemon-card_tags .tag-chip {
    padding: 2px 5px;
    font-size: 0.64rem;
  }
}

.collection-manager {
  display: grid;
  gap: 10px;
}
.collection-select {
  width: 100%;
  padding: 10px;
  border-radius: 12px;
  background: #fff;
  color: #111;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.collection-manager-actions {
  display: flex;
  gap: 8px;
}
.btn-manage {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #fff;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}
</style>

<style>
.no-scroll {
  overflow: hidden !important;
  color: red !important;
}
</style>
