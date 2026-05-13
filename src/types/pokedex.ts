export interface EvolutionLink {
  stage: number
  id: string
}

export interface PokemonForm {
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
  stage?: number
  evolutions?: EvolutionLink[]
}

export interface PokemonEntry {
  id: string
  name: string
  forms: PokemonForm[]
}

export interface PokedexJson {
  pokedex: {
    pokemon: PokemonEntry[]
  }
}

export interface CollectionState {
  normal: string[]
  shiny: string[]
}

export interface PokedexSettings {
  selectedGenerations: number[]
  excludeGigantamax: boolean
  excludeMegas: boolean
  showBoxableOnly: boolean
  showBaseFormOnly: boolean
  showShiny: boolean
  showCollectedOnly: boolean
  showUncollectedOnly: boolean
  filterQuery: string
  itemsPerPage: number
}

export interface PokedexSyncPayload {
  version: 1
  exportedAt: string
  collection: CollectionState
  settings: PokedexSettings
}
