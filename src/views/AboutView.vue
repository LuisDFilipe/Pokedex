<script setup>
import packageInfo from "../../package.json";
import { ref } from 'vue';

const appVersion = packageInfo.version;
const creator = ref('Luis D. Pereira');
const stats = [
  { label: 'Total Pokémon', value: '1,025' },
  { label: 'Regions Covered', value: '9' },
  { label: 'System Status', value: 'Online' }
];
</script>

<template>
  <div class="about-container">
    <div class="pokedex-card">
      <header class="card-header">
        <h1>The Pokedex Project</h1>
        <span class="version-tag">v{{ appVersion }}</span>
      </header>

      <section class="description">
        <p>
          Welcome to the ultimate digital encyclopedia for Pokémon Trainers.
        </p>
      </section>

      <hr class="divider" />

      <div class="stats-grid">
        <div v-for="stat in stats" :key="stat.label" class="stat-box">
          <span class="stat-label">{{ stat.label }}</span>
          <span class="stat-value">{{ stat.value }}</span>
        </div>
      </div>

      <footer class="card-footer">
        <p>Developed with ❤️ by {{ creator }}</p>
        <div class="decorative-buttons">
          <div class="dot blue"></div>
          <div class="dot red"></div>
          <div class="dot yellow"></div>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.about-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  min-height: 80vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.pokedex-card {
  background: #fdfdfd;
  border: 4px solid #333;
  border-radius: 15px;
  max-width: 500px;
  padding: 2rem;
  box-shadow: 10px 10px 0px #ee1515;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

h1 {
  margin: 0;
  color: #333;
  font-size: 1.8rem;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.version-tag {
  background: #333;
  color: white;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 0.8rem;
}

.description p {
  line-height: 1.6;
  color: #555;
}

.divider {
  border: 0;
  border-top: 2px solid #eee;
  margin: 1.5rem 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-box {
  display: flex;
  flex-direction: column;
  text-align: center;
}

.stat-label {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
}

.stat-value {
  font-weight: bold;
  color: #333;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: black;
}

.decorative-buttons {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.2);
}

.blue { background: #51adff; }
.red { background: #ff5959; }
.yellow { background: #ffd342; }
</style>