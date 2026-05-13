import type { CollectionState, PokedexJson, PokemonEntry } from '@/types/pokedex'

const COLLECTION_STORAGE_KEY = 'pokedex-collection'

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

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
    return {
      normal: isStringArray(parsed.normal) ? parsed.normal : [],
      shiny: isStringArray(parsed.shiny) ? parsed.shiny : [],
    }
  } catch {
    return { normal: [], shiny: [] }
  }
}
