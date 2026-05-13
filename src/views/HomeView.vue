<script setup lang="ts">
const quickLinks = [
  {
    title: 'Open the Pokedex',
    copy: 'Browse every tracked form, search by name or type, and mark caught variants.',
    to: '/pokedex',
  },
  {
    title: 'Check your stats',
    copy: 'See completion by generation, type coverage, and the next missing forms worth hunting.',
    to: '/stats',
  },
  {
    title: 'Read the project notes',
    copy: 'Get the current scope, release info, and the roadmap for the next pass.',
    to: '/about',
  },
]
</script>

<template>
  <section class="home-view">
    <div class="hero">
      <p class="eyebrow">Trainer dashboard</p>
      <h2>Build your collection with a little more signal.</h2>
      <p class="hero-copy">
        This project is moving from a simple sprite browser into a more useful tracker, with saved progress, richer stats, and room to grow into battle and encounter tools.
      </p>
    </div>

    <div class="link-grid">
      <router-link v-for="link in quickLinks" :key="link.title" :to="link.to" class="link-card">
        <strong>{{ link.title }}</strong>
        <p>{{ link.copy }}</p>
      </router-link>
    </div>
  </section>
</template>

<style scoped>
.home-view {
  display: grid;
  gap: 20px;
  padding: 12px;
}

.hero {
  padding: 28px 24px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top right, rgba(122, 199, 76, 0.18), transparent 28%),
    linear-gradient(135deg, rgba(99, 144, 240, 0.22), rgba(16, 16, 16, 0.96));
}

.eyebrow {
  color: #c7f0b2;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.82rem;
}

.hero h2 {
  margin-top: 10px;
  font-size: clamp(2rem, 4vw, 3.1rem);
  font-weight: 800;
  max-width: 14ch;
}

.hero-copy {
  margin-top: 12px;
  max-width: 62ch;
  color: rgba(255, 255, 255, 0.74);
}

.link-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.link-card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #f4f4f4;
}

.link-card strong {
  font-size: 1.05rem;
}

.link-card p {
  color: rgba(255, 255, 255, 0.68);
}

.link-card:hover {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
}

@media (max-width: 900px) {
  .link-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 22px 18px;
  }
}
</style>
