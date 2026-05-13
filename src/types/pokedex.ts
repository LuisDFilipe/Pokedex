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
