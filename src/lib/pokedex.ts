import type {
  CollectionFilters,
  CollectionState,
  NamedCollection,
  PokedexJson,
  PokedexSettings,
  PokedexSyncPayload,
  PokemonEntry,
} from '@/types/pokedex'

export const COLLECTIONS_STORAGE_KEY = 'pokedex-collections'
export const SETTINGS_STORAGE_KEY = 'pokedex-settings'

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isStringArrayRecord = (value: unknown): value is Record<string, string[]> =>
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.values(value as Record<string, unknown>).every(isStringArray)

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isString = (value: unknown): value is string => typeof value === 'string'

export const defaultSettings: PokedexSettings = {
  filterQuery: '',
  randomOrder: false,
  showShiny: false,
  itemsPerPage: 12,

  activeCollectionId: 'default',

  selectedGenerations: [],

  excludeGigantamax: false,
  showOnlyGigantamax: false,

  excludeMegas: false,
  showOnlyMegas: false,

  excludeBoxable: false,
  showBoxableOnly: false,

  showBaseFormOnly: false,
  excludeBaseForm: false,

  groupForms: true,

  showEvolutionChain: true,
  showTypeMatchups: true,
  showForms: true,

  showCollectedOnly: false,
  showUncollectedOnly: false,
  selectedTags: [],
  excludedTags: [],
  showUntaggedOnly: false,
}

export const defaultCollectionFilters: CollectionFilters = {
  filterQuery: defaultSettings.filterQuery,
  randomOrder: defaultSettings.randomOrder,
  showShiny: defaultSettings.showShiny,
  itemsPerPage: defaultSettings.itemsPerPage,
  selectedGenerations: [...defaultSettings.selectedGenerations],
  excludeGigantamax: defaultSettings.excludeGigantamax,
  showOnlyGigantamax: defaultSettings.showOnlyGigantamax,
  excludeMegas: defaultSettings.excludeMegas,
  showOnlyMegas: defaultSettings.showOnlyMegas,
  excludeBoxable: defaultSettings.excludeBoxable,
  showBoxableOnly: defaultSettings.showBoxableOnly,
  showBaseFormOnly: defaultSettings.showBaseFormOnly,
  excludeBaseForm: defaultSettings.excludeBaseForm,
  groupForms: defaultSettings.groupForms,
  showEvolutionChain: defaultSettings.showEvolutionChain,
  showTypeMatchups: defaultSettings.showTypeMatchups,
  showForms: defaultSettings.showForms,
  showCollectedOnly: defaultSettings.showCollectedOnly,
  showUncollectedOnly: defaultSettings.showUncollectedOnly,
  selectedTags: [...defaultSettings.selectedTags],
  excludedTags: [...defaultSettings.excludedTags],
  showUntaggedOnly: defaultSettings.showUntaggedOnly,
}

export async function loadPokedex(): Promise<PokemonEntry[]> {
  const response = await fetch('/pokedex.json')

  if (!response.ok) {
    throw new Error(`Failed to load pokedex.json: ${response.status}`)
  }

  const data = (await response.json()) as PokedexJson
  return data.pokedex.pokemon
}

export function readCollections(): NamedCollection[] {
  if (typeof window === 'undefined') {
    return []
  }

  const rawValue = localStorage.getItem(COLLECTIONS_STORAGE_KEY)
  if (!rawValue) {
    // Migration: try to read from old single collection key
    const oldKey = 'pokedex-collection'
    const oldRaw = localStorage.getItem(oldKey)
    const initialState = oldRaw ? normalizeCollection(JSON.parse(oldRaw)) : { normal: [], shiny: [], tags: {} }
    return [{ id: 'default', name: 'Main Collection', state: initialState, filters: normalizeCollectionFilters(readSettings()) }]
  }

  try {
    const parsed = JSON.parse(rawValue) as Array<Partial<NamedCollection>>
    const settings = readSettings()
    return parsed.map((item, index) =>
      normalizeNamedCollection(
        {
          ...item,
          filters: item.filters ?? (item.id === settings.activeCollectionId ? settings : undefined),
        },
        `collection-${index + 1}`,
      ),
    )
  } catch {
    return [{ id: 'default', name: 'Main Collection', state: { normal: [], shiny: [], tags: {} }, filters: normalizeCollectionFilters(readSettings()) }]
  }
}

export function writeCollections(collections: NamedCollection[]) {
  const normalized = collections.map((collection) => normalizeNamedCollection(collection))
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(normalized))
}

export function readActiveCollectionState(): CollectionState {
  const settings = readSettings()
  const collections = readCollections()
  const active = collections.find((c) => c.id === settings.activeCollectionId) || collections[0]
  return active?.state || { normal: [], shiny: [], tags: {} }
}

export function readSettings(): PokedexSettings {
  if (typeof window === 'undefined') {
    return { ...defaultSettings }
  }

  const rawValue = localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!rawValue) {
    return { ...defaultSettings }
  }

  try {
    return normalizeSettings(JSON.parse(rawValue))
  } catch {
    return { ...defaultSettings }
  }
}

export function writeSettings(settings: PokedexSettings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)))
}

export function createSyncPayload(
  collections: NamedCollection[],
  settings: PokedexSettings,
): PokedexSyncPayload {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    collections: normalizeCollections(collections),
    settings: normalizeSettings(settings),
  }
}

export function parseSyncPayload(rawValue: string): PokedexSyncPayload {
  const parsed = JSON.parse(rawValue) as Partial<PokedexSyncPayload>

  if (parsed.version !== 1 && parsed.version !== 2) {
    throw new Error('Unsupported sync file version.')
  }

  if (!isString(parsed.exportedAt)) {
    throw new Error('Sync file is missing an export date.')
  }

  return {
    version: parsed.version,
    exportedAt: parsed.exportedAt,
    collection: parsed.collection ? normalizeCollection(parsed.collection) : undefined,
    collections:
      parsed.version === 2
        ? normalizeCollections(parsed.collections)
        : [
            {
              id: 'default',
              name: 'Main Collection',
              state: normalizeCollection(parsed.collection),
              filters: normalizeCollectionFilters(parsed.settings),
            },
          ],
    settings: normalizeSettings(parsed.settings),
  }
}

function normalizeCollections(value: unknown): NamedCollection[] {
  if (!Array.isArray(value)) {
    return []
  }

  const usedIds = new Set<string>()
  return value.map((item, index) => {
    const collection = normalizeNamedCollection(item, `collection-${index + 1}`)
    let id = collection.id
    while (usedIds.has(id)) {
      id = `${collection.id}-${usedIds.size + 1}`
    }
    usedIds.add(id)

    return {
      ...collection,
      id,
    }
  })
}

function normalizeNamedCollection(value: unknown, fallbackId = 'default'): NamedCollection {
  const collection = value as Partial<NamedCollection> | undefined

  return {
    id: isString(collection?.id) && collection.id.trim() ? collection.id : fallbackId,
    name: isString(collection?.name) && collection.name.trim() ? collection.name : 'Unnamed Collection',
    state: normalizeCollection(collection?.state),
    filters: normalizeCollectionFilters(collection?.filters),
  }
}

function normalizeCollection(value: unknown): CollectionState {
  const collection = value as Partial<CollectionState> | undefined

  return {
    normal: isStringArray(collection?.normal) ? [...new Set(collection.normal)] : [],
    shiny: isStringArray(collection?.shiny) ? [...new Set(collection.shiny)] : [],
    tags: normalizeTags(collection?.tags),
  }
}

function normalizeTags(value: unknown): Record<string, string[]> {
  if (!isStringArrayRecord(value)) {
    return {}
  }

  const entries: Array<[string, string[]]> = []

  Object.entries(value).forEach(([id, tags]) => {
    const normalizedTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))

    if (normalizedTags.length > 0) {
      entries.push([id, normalizedTags])
    }
  })

  return Object.fromEntries(entries)
}

function normalizeCollectionFilters(value: unknown): CollectionFilters {
  const settings = normalizeSettings(value)
  const { activeCollectionId, ...filters } = settings

  return filters
}

function normalizeSettings(value: unknown): PokedexSettings {
  const settings = value as Partial<PokedexSettings> | undefined

  return {
    filterQuery: isString(settings?.filterQuery) ? settings.filterQuery : '',
    randomOrder: isBoolean(settings?.randomOrder) ? settings.randomOrder : false,
    showShiny: isBoolean(settings?.showShiny) ? settings.showShiny : false,
    itemsPerPage: isNumber(settings?.itemsPerPage) ? settings.itemsPerPage : defaultSettings.itemsPerPage,
    activeCollectionId: isString(settings?.activeCollectionId) ? settings.activeCollectionId : 'default',
    selectedGenerations: isNumberArray(settings?.selectedGenerations) ? settings.selectedGenerations : [],
    excludeGigantamax: isBoolean(settings?.excludeGigantamax) ? settings.excludeGigantamax : false,
    showOnlyGigantamax: isBoolean(settings?.showOnlyGigantamax) ? settings.showOnlyGigantamax : false,
    excludeMegas: isBoolean(settings?.excludeMegas) ? settings.excludeMegas : false,
    showOnlyMegas: isBoolean(settings?.showOnlyMegas) ? settings.showOnlyMegas : false,
    excludeBoxable: isBoolean(settings?.excludeBoxable) ? settings.excludeBoxable : false,
    showBoxableOnly: isBoolean(settings?.showBoxableOnly) ? settings.showBoxableOnly : false,
    showBaseFormOnly: isBoolean(settings?.showBaseFormOnly) ? settings.showBaseFormOnly : false,
    excludeBaseForm: isBoolean(settings?.excludeBaseForm) ? settings.excludeBaseForm : false,
    groupForms: isBoolean(settings?.groupForms) ? settings.groupForms : false,
    showEvolutionChain: isBoolean(settings?.showEvolutionChain) ? settings.showEvolutionChain : true,
    showTypeMatchups: isBoolean(settings?.showTypeMatchups) ? settings.showTypeMatchups : true,
    showForms: isBoolean(settings?.showForms) ? settings.showForms : true,
    showCollectedOnly: isBoolean(settings?.showCollectedOnly) ? settings.showCollectedOnly : false,
    showUncollectedOnly: isBoolean(settings?.showUncollectedOnly) ? settings.showUncollectedOnly : false,
    selectedTags: isStringArray(settings?.selectedTags) ? settings.selectedTags : [],
    excludedTags: isStringArray(settings?.excludedTags) ? settings.excludedTags : [],
    showUntaggedOnly: isBoolean(settings?.showUntaggedOnly) ? settings.showUntaggedOnly : false,
  }
}
