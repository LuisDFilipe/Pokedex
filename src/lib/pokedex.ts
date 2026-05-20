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

  showCollectedOnly: false,
  showUncollectedOnly: false,
}

export const defaultCollectionFilters: CollectionFilters = {
  filterQuery: defaultSettings.filterQuery,
  randomOrder: defaultSettings.randomOrder,
  showShiny: defaultSettings.showShiny,
  itemsPerPage: defaultSettings.itemsPerPage,
  selectedGenerations: defaultSettings.selectedGenerations,
  excludeGigantamax: defaultSettings.excludeGigantamax,
  showOnlyGigantamax: defaultSettings.showOnlyGigantamax,
  excludeMegas: defaultSettings.excludeMegas,
  showOnlyMegas: defaultSettings.showOnlyMegas,
  excludeBoxable: defaultSettings.excludeBoxable,
  showBoxableOnly: defaultSettings.showBoxableOnly,
  showBaseFormOnly: defaultSettings.showBaseFormOnly,
  excludeBaseForm: defaultSettings.excludeBaseForm,
  groupForms: defaultSettings.groupForms,
  showCollectedOnly: defaultSettings.showCollectedOnly,
  showUncollectedOnly: defaultSettings.showUncollectedOnly,
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
    const initialState = oldRaw ? normalizeCollection(JSON.parse(oldRaw)) : { normal: [], shiny: [] }
    return [{ id: 'default', name: 'Main Collection', state: initialState, filters: normalizeCollectionFilters(readSettings()) }]
  }

  try {
    const parsed = JSON.parse(rawValue) as any[]
    const settings = readSettings()
    return parsed.map((item) => ({
      id: isString(item.id) ? item.id : String(Date.now() + Math.random()),
      name: isString(item.name) ? item.name : 'Unnamed Collection',
      state: normalizeCollection(item.state),
      filters: normalizeCollectionFilters(item.filters ?? (item.id === settings.activeCollectionId ? settings : undefined)),
    }))
  } catch {
    return [{ id: 'default', name: 'Main Collection', state: { normal: [], shiny: [] }, filters: normalizeCollectionFilters(readSettings()) }]
  }
}

export function writeCollections(collections: NamedCollection[]) {
  const normalized = collections.map((c) => ({
    ...c,
    state: normalizeCollection(c.state),
    filters: normalizeCollectionFilters(c.filters),
  }))
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(normalized))
}

export function readActiveCollectionState(): CollectionState {
  const settings = readSettings()
  const collections = readCollections()
  const active = collections.find((c) => c.id === settings.activeCollectionId) || collections[0]
  return active?.state || { normal: [], shiny: [] }
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
  collection: CollectionState,
  settings: PokedexSettings,
): PokedexSyncPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    collection: normalizeCollection(collection),
    settings: normalizeSettings(settings),
  }
}

export function parseSyncPayload(rawValue: string): PokedexSyncPayload {
  const parsed = JSON.parse(rawValue) as Partial<PokedexSyncPayload>

  if (parsed.version !== 1) {
    throw new Error('Unsupported sync file version.')
  }

  if (!isString(parsed.exportedAt)) {
    throw new Error('Sync file is missing an export date.')
  }

  return {
    version: 1,
    exportedAt: parsed.exportedAt,
    collection: normalizeCollection(parsed.collection),
    settings: normalizeSettings(parsed.settings),
  }
}

function normalizeCollection(value: unknown): CollectionState {
  const collection = value as Partial<CollectionState> | undefined

  return {
    normal: isStringArray(collection?.normal) ? [...new Set(collection.normal)] : [],
    shiny: isStringArray(collection?.shiny) ? [...new Set(collection.shiny)] : [],
  }
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
    showCollectedOnly: isBoolean(settings?.showCollectedOnly) ? settings.showCollectedOnly : false,
    showUncollectedOnly: isBoolean(settings?.showUncollectedOnly) ? settings.showUncollectedOnly : false,
  }
}
