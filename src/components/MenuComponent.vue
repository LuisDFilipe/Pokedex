<script setup lang="ts">
import packageInfo from "../../package.json";
import { ref, watch } from "vue";
import { useRoute } from "vue-router";

/* import HomeIcon from "./icons/HomeIcon.vue"; */
import PokedexIcon from "./icons/PokedexIcon.vue";
/* import GameIcon from "./icons/GameIcon.vue"; */
/* import StatsIcon from "./icons/StatsIcon.vue"; */
import AboutIcon from "./icons/AboutIcon.vue";

const appVersion = packageInfo.version;
const isOpen = ref(false);
const route = useRoute();

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

const closeMenu = () => {
  isOpen.value = false;
};

// Close the menu automatically if the URL changes
watch(
  () => route.path,
  () => {
    closeMenu();
  },
);
</script>

<template>
  <nav class="nav-container">
    <Transition name="fade">
      <div v-if="isOpen" class="overlay" @click="closeMenu"></div>
    </Transition>

    <button
      class="burger-btn"
      @click="toggleMenu"
      :class="{ 'is-active': isOpen }"
      aria-label="Toggle Menu"
    >
      <span class="line"></span>
      <span class="line"></span>
      <span class="line"></span>
    </button>

    <div class="nav-drawer" :class="{ open: isOpen }">
      <div class="version-tag">v{{ appVersion }}</div>
      <div class="drawer-content">
<!--         <router-link to="/" class="nav-item" @click="closeMenu">
          <HomeIcon /> <span>Home</span>
        </router-link> -->

        <router-link to="/pokedex" class="nav-item" @click="closeMenu">
          <PokedexIcon /> <span>Pokedex</span>
        </router-link>

<!--         <router-link to="/game" class="nav-item" @click="closeMenu">
          <GameIcon /> <span>Game</span>
        </router-link> -->
        
<!--         <router-link to="/stats" class="nav-item" @click="closeMenu">
          <StatsIcon /> <span>Stats</span>
        </router-link> -->

        <router-link to="/about" class="nav-item" @click="closeMenu">
          <AboutIcon /> <span>About</span>
        </router-link>
      </div>
    </div>
  </nav>
</template>

<style scoped>

.nav-container {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 200px;
  background-color: #0d0d0d;
  border-right: 1px solid #333;
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

/* Hide burger button on desktop */
.burger-btn {
  display: none;
}

.version-tag {
  font-size: 12px;
  color: #444;
  padding: 10px 20px;
  text-align: center;
}

.nav-drawer {
  width: 100%;
  height: 100%;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  padding: 40px 20px;
  gap: 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.1rem;
  padding: 12px 20px;
  color: #888;
  text-decoration: none;
  border-radius: 12px;
  transition: 0.3s;
}

.nav-item:hover,
.router-link-active {
  background: #1a1a1a;
  color: #ff4747 !important;
}

.overlay {
  display: none;
}

@media (max-width: 1024px) {
  .overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1999;
    pointer-events: auto;
  }

  .nav-container {
    height: auto;
    width: 100%;
    border-right: none;
    background: transparent;
    padding: 20px;
    pointer-events: none;
  }

  .burger-btn {
    display: flex;
    pointer-events: auto;
    position: relative;
    z-index: 2001;
    flex-direction: column;
    gap: 6px;
    background: #1a1a1a;
    border: 1px solid #333;
    padding: 12px;
    border-radius: 8px;
    width: fit-content;
  }

  .line {
    width: 24px;
    height: 2px;
    background-color: white;
    transition: 0.3s;
  }

  .burger-btn.is-active .line:nth-child(1) {
    transform: translateY(8px) rotate(45deg);
  }
  .burger-btn.is-active .line:nth-child(2) {
    opacity: 0;
  }
  .burger-btn.is-active .line:nth-child(3) {
    transform: translateY(-8px) rotate(-45deg);
  }

  .nav-drawer {
    pointer-events: auto;
    position: fixed;
    top: 0;
    left: -200px;
    z-index: 2000;
    width: 200px;
    height: 100vh;
    background-color: #0d0d0d;
    border-right: 1px solid #333;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .nav-drawer.open {
    transform: translateX(200px);
  }

  .drawer-content {
    padding-top: 100px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
