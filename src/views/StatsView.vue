<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { loadPokedex, readCollection } from '@/lib/pokedex'
import type { PokemonEntry, PokemonForm } from '@/types/pokedex'

type FormWithPokemon = PokemonForm & {
  pokemonId: string
  pokemonName: string
  isBaseForm: boolean
}

const pokemon = ref<PokemonEntry[]>([])
const loading = ref(true)
const error = ref('')
const collectedNormal = ref<string[]>([])
const collectedShiny = ref<string[]>([])

const allForms = computed<FormWithPokemon[]>(() =>
  pokemon.value.flatMap((entry) =>
    entry.forms.map((form, index) => ({
      ...form,
      pokemonId: entry.id,
      pokemonName: entry.name,
      isBaseForm: index === 0,
    })),
  ),
)

const boxableFormList = computed(() => allForms.value.filter((form) => form.boxable))
const trackedSpecies = computed(() => new Set(boxableFormList.value.map((form) => form.pokemonId)).size)

const normalSet = computed(() => new Set(collectedNormal.value))
const shinySet = computed(() => new Set(collectedShiny.value))
const collectedBoxableNormalCount = computed(
  () => boxableFormList.value.filter((form) => normalSet.value.has(form.id)).length,
)
const collectedBoxableShinyCount = computed(
  () => boxableFormList.value.filter((form) => shinySet.value.has(form.id)).length,
)

const completionPercentage = (collected: number, total: number) =>
  total === 0 ? 0 : Math.round((collected / total) * 100)

const totalForms = computed(() => boxableFormList.value.length)
const shinyReadyForms = computed(() => boxableFormList.value.filter((form) => form.sprite).length)

const summaryCards = computed(() => [
  {
    label: 'Species tracked',
    value: trackedSpecies.value.toLocaleString(),
    helper: `${totalForms.value.toLocaleString()} boxable forms indexed`,
  },
  {
    label: 'Normal collection',
    value: `${completionPercentage(collectedBoxableNormalCount.value, totalForms.value)}%`,
    helper: `${collectedBoxableNormalCount.value.toLocaleString()} of ${totalForms.value.toLocaleString()} forms`,
  },
  {
    label: 'Shiny collection',
    value: `${completionPercentage(collectedBoxableShinyCount.value, totalForms.value)}%`,
    helper: `${collectedBoxableShinyCount.value.toLocaleString()} of ${totalForms.value.toLocaleString()} forms`,
  },
  {
    label: 'Boxable forms',
    value: totalForms.value.toLocaleString(),
    helper: 'Only boxable forms are counted on this page',
  },
])

const generationBreakdown = computed(() => {
  const generationMap = new Map<number, { total: number; normal: number; shiny: number }>()

  boxableFormList.value.forEach((form) => {
    const current = generationMap.get(form.gen) ?? { total: 0, normal: 0, shiny: 0 }
    current.total += 1
    if (normalSet.value.has(form.id)) current.normal += 1
    if (shinySet.value.has(form.id)) current.shiny += 1
    generationMap.set(form.gen, current)
  })

  return Array.from(generationMap.entries())
    .sort(([left], [right]) => left - right)
    .map(([generation, stats]) => ({
      generation,
      ...stats,
      normalRate: completionPercentage(stats.normal, stats.total),
      shinyRate: completionPercentage(stats.shiny, stats.total),
    }))
})

const typeBreakdown = computed(() => {
  const typeMap = new Map<string, { total: number; owned: number }>()

  boxableFormList.value.forEach((form) => {
    const uniqueTypes = [form.type1, form.type2].filter((type): type is string => Boolean(type))
    uniqueTypes.forEach((type) => {
      const current = typeMap.get(type) ?? { total: 0, owned: 0 }
      current.total += 1
      if (normalSet.value.has(form.id)) current.owned += 1
      typeMap.set(type, current)
    })
  })

  return Array.from(typeMap.entries())
    .map(([type, stats]) => ({
      type,
      ...stats,
      rate: completionPercentage(stats.owned, stats.total),
    }))
    .sort((left, right) => right.rate - left.rate || left.type.localeCompare(right.type))
})

const topMissingForms = computed(() =>
  boxableFormList.value
    .filter((form) => !normalSet.value.has(form.id))
    .slice(0, 8)
    .map((form) => ({
      id: form.id,
      name: form.name,
      pokemonName: form.pokemonName,
      generation: form.gen,
      label: form.name === form.pokemonName ? form.pokemonName : `${form.pokemonName} (${form.name})`,
    })),
)

const collectionNotes = computed(() => [
  `${shinyReadyForms.value.toLocaleString()} boxable forms currently have sprite support in the dataset.`,
  `${completionPercentage(collectedBoxableNormalCount.value, totalForms.value)}% of boxable forms are marked in the normal collection.`,
  `${completionPercentage(collectedBoxableShinyCount.value, totalForms.value)}% of boxable forms are marked in the shiny collection.`,
])

onMounted(async () => {
  try {
    pokemon.value = await loadPokedex()
    const collection = readCollection()
    collectedNormal.value = collection.normal
    collectedShiny.value = collection.shiny
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="stats-view">
    <div class="stats-hero">
      <div>
        <p class="eyebrow">Collection overview</p>
        <h2>Your Pokedex progress</h2>
        <p class="hero-copy">
          A quick read on collection completion, generation coverage, and the gaps that are still worth chasing.
        </p>
      </div>
    </div>

    <p v-if="loading" class="status">Loading stats...</p>
    <p v-else-if="error" class="status error">{{ error }}</p>

    <template v-else>
      <div class="summary-grid">
        <article v-for="card in summaryCards" :key="card.label" class="summary-card">
          <p class="summary-label">{{ card.label }}</p>
          <p class="summary-value">{{ card.value }}</p>
          <p class="summary-helper">{{ card.helper }}</p>
        </article>
      </div>

      <div class="stats-layout">
        <section class="panel">
          <div class="panel-header">
            <h3>By generation</h3>
            <span>{{ generationBreakdown.length }} tracked</span>
          </div>

          <div class="generation-list">
            <article v-for="entry in generationBreakdown" :key="entry.generation" class="generation-row">
              <div class="generation-copy">
                <strong>Gen {{ entry.generation }}</strong>
                <span>{{ entry.total }} forms</span>
              </div>
              <div class="meter-group">
                <div>
                  <label>Normal</label>
                  <div class="meter">
                    <span :style="{ width: `${entry.normalRate}%` }"></span>
                  </div>
                </div>
                <div>
                  <label>Shiny</label>
                  <div class="meter shiny">
                    <span :style="{ width: `${entry.shinyRate}%` }"></span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h3>Type coverage</h3>
            <span>Normal collection</span>
          </div>

          <div class="type-list">
            <article v-for="entry in typeBreakdown" :key="entry.type" class="type-row">
              <div class="type-meta">
                <strong>{{ entry.type }}</strong>
                <span>{{ entry.owned }}/{{ entry.total }}</span>
              </div>
              <div class="meter">
                <span :style="{ width: `${entry.rate}%` }"></span>
              </div>
            </article>
          </div>
        </section>
      </div>

      <div class="stats-layout secondary">
        <section class="panel">
          <div class="panel-header">
            <h3>Next targets</h3>
            <span>{{ topMissingForms.length }} suggestions</span>
          </div>

          <ul class="missing-list">
            <li v-for="form in topMissingForms" :key="form.id">
              <strong>{{ form.label }}</strong>
              <span>#{{ form.id }} · Gen {{ form.generation }}</span>
            </li>
          </ul>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h3>Collection notes</h3>
            <span>Dataset health</span>
          </div>

          <ul class="notes-list">
            <li v-for="note in collectionNotes" :key="note">{{ note }}</li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.stats-view {
  display: grid;
  gap: 20px;
  padding: 12px;
  color: #f4f4f4;
}

.stats-hero {
  background:
    radial-gradient(circle at top right, rgba(255, 201, 60, 0.18), transparent 28%),
    linear-gradient(135deg, rgba(255, 71, 71, 0.24), rgba(22, 22, 22, 0.94));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 24px;
}

.eyebrow {
  color: #ffb0b0;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stats-hero h2 {
  margin-top: 8px;
  font-size: clamp(2rem, 3vw, 2.8rem);
  font-weight: 800;
}

.hero-copy {
  max-width: 60ch;
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.74);
}

.status {
  color: rgba(255, 255, 255, 0.72);
}

.status.error {
  color: #ff9a9a;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.summary-card,
.panel {
  background: rgba(14, 14, 14, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 18px;
}

.summary-label,
.panel-header span {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.9rem;
}

.summary-value {
  margin-top: 10px;
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
}

.summary-helper {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.7);
}

.stats-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: 16px;
}

.stats-layout.secondary {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 1.15rem;
  font-weight: 700;
}

.generation-list,
.type-list,
.missing-list,
.notes-list {
  display: grid;
  gap: 12px;
}

.generation-row,
.type-row {
  display: grid;
  gap: 10px;
}

.generation-copy,
.type-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.generation-copy span,
.type-meta span,
.missing-list span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.92rem;
}

.meter-group {
  display: grid;
  gap: 10px;
}

.meter-group label {
  display: block;
  margin-bottom: 6px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.82rem;
}

.meter {
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ff6b6b, #ffd166);
}

.meter.shiny span {
  background: linear-gradient(90deg, #7dd3fc, #facc15);
}

.missing-list,
.notes-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.missing-list li,
.notes-list li {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px 14px;
}

.missing-list li {
  display: grid;
  gap: 4px;
}

@media (max-width: 1100px) {
  .summary-grid,
  .stats-layout,
  .stats-layout.secondary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .summary-grid,
  .stats-layout,
  .stats-layout.secondary {
    grid-template-columns: 1fr;
  }

  .stats-hero,
  .summary-card,
  .panel {
    padding: 16px;
  }
}
</style>
