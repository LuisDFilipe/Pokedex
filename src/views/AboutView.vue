<script setup lang="ts">
import packageInfo from '../../package.json'

const appVersion = packageInfo.version

const projectFacts = [
  { label: 'Current release', value: `v${appVersion}` },
  { label: 'Built with', value: 'Vue 3 + TypeScript + Vite' },
  { label: 'Focus', value: 'Collection tracking and Pokedex browsing' },
]

const nextSteps = [
  'Add deeper species detail such as evolutions, weaknesses, and move context.',
  'Grow the game prototype into a cleaner encounter and battle loop.',
  'Keep tightening the collection workflow around progress tracking.',
]
</script>

<template>
  <section class="about-view">
    <article class="about-card">
      <p class="eyebrow">Project overview</p>
      <h2>The Pokedex Project</h2>
      <p class="lead">
        A personal Pokemon tracker built around form browsing, collection logging, and a growing set of trainer-facing tools.
      </p>

      <div class="facts-grid">
        <div v-for="fact in projectFacts" :key="fact.label" class="fact-card">
          <span>{{ fact.label }}</span>
          <strong>{{ fact.value }}</strong>
        </div>
      </div>

      <section class="about-section">
        <h3>What is already working</h3>
        <p>
          The Pokedex view already handles filters, pagination, shiny tracking, and saved collection state. This release also adds a fuller stats dashboard so the collection data becomes more useful.
        </p>
      </section>

      <section class="about-section">
        <h3>What comes next</h3>
        <ul>
          <li v-for="item in nextSteps" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="about-section support-section">
        <h3>Support the project</h3>
        <p>
          If this tracker has been useful, you can support future updates and feature work on Ko-fi.
        </p>
        <a
          href="https://ko-fi.com/luisdfilipe"
          target="_blank"
          rel="noreferrer"
          class="support-button"
        >
          Buy me a coffee
        </a>
      </section>
    </article>
  </section>
</template>

<style scoped>
.about-view {
  display: grid;
  place-items: center;
  padding: 16px;
}

.about-card {
  width: min(760px, 100%);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
    #101010;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
}

.eyebrow {
  color: #ffb4b4;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
}

.about-card h2 {
  margin-top: 10px;
  font-size: clamp(2rem, 3vw, 2.6rem);
  font-weight: 800;
}

.lead {
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.72);
  max-width: 60ch;
}

.facts-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 24px;
}

.fact-card,
.about-section {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.fact-card {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.fact-card span {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.88rem;
}

.fact-card strong {
  color: #fff;
  font-size: 1rem;
}

.about-section {
  margin-top: 16px;
  padding: 18px;
}

.about-section h3 {
  margin-bottom: 10px;
  font-size: 1.05rem;
  font-weight: 700;
}

.about-section p,
.about-section li {
  color: rgba(255, 255, 255, 0.76);
}

.about-section ul {
  margin: 0;
  padding-left: 18px;
}

.support-section {
  display: grid;
  gap: 14px;
}

.support-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  background: #ff4747;
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  transition: background 0.2s ease, transform 0.2s ease;
}

.support-button:hover {
  background: #ff5a5a;
  transform: translateY(-1px);
}

@media (max-width: 720px) {
  .facts-grid {
    grid-template-columns: 1fr;
  }

  .about-card {
    padding: 18px;
  }
}
</style>
