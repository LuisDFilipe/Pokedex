<script setup lang="ts">
import HomeIcon from './icons/HomeIcon.vue'
import PokedexIcon from './icons/PokedexIcon.vue'
import StatsIcon from './icons/StatsIcon.vue'
import AboutIcon from './icons/AboutIcon.vue'

</script>


<template>
  <nav class="nav-container">
    <div class="nav-pill">
      <router-link to="/" class="nav-item">
        <HomeIcon /> Home
      </router-link>
      
      <router-link to="/pokedex" class="nav-item">
        <PokedexIcon /> Pokedex
      </router-link>
      
      <router-link to="/stats" class="nav-item">
        <StatsIcon /> Stats
      </router-link>
      
      <router-link to="/about" class="nav-item">
        <AboutIcon /> About
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.nav-container {
  display: flex;
  justify-content: center;
  background-color: #000; /* Dark background like your image */
}

.nav-pill {
  display: flex;
  align-items: center;
  background-color: #1a1a1a;
  border: 1px solid #333;
  padding: 6px;
  border-radius: 50px; /* Makes it pill-shaped */
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  color: #888;
  text-decoration: none;
  font-family: sans-serif;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 40px;
}

.nav-item:hover {
  color: white;
}

/* This is the magic class Vue Router adds automatically */
.router-link-active {
  background-color: #2a2a2a;
  color: white;
}

/* MOBILE */
@media (max-width: 600px) {
  .nav-container {
    width: 100%;
    position: fixed; /* Stick to the bottom */
    bottom: 0;
    left: 0;
    padding: 0;
    z-index: 1000;
    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  }

  .nav-pill {
    width: 100%;
    border-radius: 0; /* Full width bar on mobile */
    border: none;
    border-top: 1px solid #333;
    padding: 10px 0;
    justify-content: space-around; /* Space items evenly */
    background-color: #000;
  }

  .nav-item {
    flex-direction: column; /* Stack Icon over Text */
    gap: 4px;
    padding: 5px;
    font-size: 11px; /* Smaller text for mobile */
  }

  .nav-item .icon {
    font-size: 20px; /* Make icons more prominent */
  }

  .nav-item.router-link-active {
    background-color: transparent; /* Remove background pill on mobile */
    color: #ff4747; /* Just change the text color */
  }
}
</style>