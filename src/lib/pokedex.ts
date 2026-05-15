import type {
  CollectionState,
  PokedexJson,
  PokedexSettings,
  PokedexSyncPayload,
  PokemonEntry,
} from '@/types/pokedex'

export const COLLECTION_STORAGE_KEY = 'pokedex-collection'
export const SETTINGS_STORAGE_KEY = 'pokedex-settings'

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isString = (value: unknown): value is string => typeof value === 'string'

export const defaultSettings: PokedexSettings = {
  selectedGenerations: [],
  excludeGigantamax: false,
  excludeMegas: false,
  showBoxableOnly: false,
  showBaseFormOnly: false,
  showShiny: false,
  showCollectedOnly: false,
  showUncollectedOnly: false,
  filterQuery: '',
  itemsPerPage: 12,
  groupForms: true,
}

export async function loadPokedex(): Promise<PokemonEntry[]> {
  const response = await fetch('/pokedex.json')

  if (!response.ok) {
    throw new Error(`Failed to load pokedex.json: ${response.status}`)
  }

  const data = (await response.json()) as PokedexJson
  return data.pokedex.pokemon
}

export function readCollection(): CollectionState {
  if (typeof window === 'undefined') {
    return { normal: [], shiny: [] }
  }

  const rawValue = localStorage.getItem(COLLECTION_STORAGE_KEY)
  if (!rawValue) {
    return { normal: [], shiny: [] }
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<CollectionState>
    return normalizeCollection(parsed)
  } catch {
    return { normal: [], shiny: [] }
  }
}

export function writeCollection(collection: CollectionState) {
  localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(normalizeCollection(collection)))
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

function normalizeSettings(value: unknown): PokedexSettings {
  const settings = value as Partial<PokedexSettings> | undefined

  return {
    selectedGenerations: isNumberArray(settings?.selectedGenerations) ? settings.selectedGenerations : [],
    excludeGigantamax: isBoolean(settings?.excludeGigantamax) ? settings.excludeGigantamax : false,
    excludeMegas: isBoolean(settings?.excludeMegas) ? settings.excludeMegas : false,
    showBoxableOnly: isBoolean(settings?.showBoxableOnly) ? settings.showBoxableOnly : false,
    showBaseFormOnly: isBoolean(settings?.showBaseFormOnly) ? settings.showBaseFormOnly : false,
    showShiny: isBoolean(settings?.showShiny) ? settings.showShiny : false,
    showCollectedOnly: isBoolean(settings?.showCollectedOnly) ? settings.showCollectedOnly : false,
    showUncollectedOnly: isBoolean(settings?.showUncollectedOnly) ? settings.showUncollectedOnly : false,
    filterQuery: isString(settings?.filterQuery) ? settings.filterQuery : '',
    itemsPerPage: isNumber(settings?.itemsPerPage) ? settings.itemsPerPage : defaultSettings.itemsPerPage,
    groupForms: isBoolean(settings?.groupForms) ? settings.groupForms : false,
  }
}
