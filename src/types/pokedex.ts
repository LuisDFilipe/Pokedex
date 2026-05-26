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
  tags: Record<string, string[]>
}

export interface NamedCollection {
  id: string
  name: string
  state: CollectionState
  filters: CollectionFilters
}

export interface PokedexSettings {
  filterQuery: string
  randomOrder: boolean
  showShiny: boolean
  itemsPerPage: number
  
  activeCollectionId: string

  selectedGenerations: number[]

  excludeGigantamax: boolean
  showOnlyGigantamax: boolean

  excludeMegas: boolean
  showOnlyMegas: boolean

  excludeBoxable: boolean
  showBoxableOnly: boolean

  showBaseFormOnly: boolean
  excludeBaseForm: boolean

  groupForms: boolean

  showEvolutionChain: boolean
  showTypeMatchups: boolean
  showForms: boolean

  showCollectedOnly: boolean
  showUncollectedOnly: boolean
  selectedTags: string[]
  excludedTags: string[]
  showUntaggedOnly: boolean
}

export type CollectionFilters = Omit<PokedexSettings, 'activeCollectionId'>

export interface PokedexSyncPayload {
  version: 1 | 2
  exportedAt: string
  collection?: CollectionState
  collections: NamedCollection[]
  settings: PokedexSettings
}
