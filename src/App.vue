<script setup lang="ts">
import { useRoute } from 'vue-router'
import MenuComponent from './components/MenuComponent.vue'

const route = useRoute()
</script>

<template>
  <div class="app-wrapper">
    <header class="page-header">
      <h1 class="main-title">
        {{ route.meta.title }}
      </h1>
      <p v-if="route.meta.description" class="section-description">
        {{ route.meta.description }}
      </p>
    </header>

    <MenuComponent />

    <main class="content-area">
      <router-view />
    </main>
  </div>
</template>

<style>
body {
  margin: 0;
  background:
    radial-gradient(circle at top, rgba(255, 71, 71, 0.14), transparent 32%),
    linear-gradient(180deg, #0b0b0b 0%, #000 100%);
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-wrapper {
  display: flex;
  flex-direction: column; /* Stack header, nav, and content vertically */
  align-items: stretch;
  min-height: 100vh;
  /* Leave room for the 300px sidebar on desktop */
  margin-left: 200px;
  transition: margin-left 0.3s ease;
}

.content-area {
  width: min(1600px, 100%);
  margin: 0 auto;
  padding: 0 10px 32px;
}

.page-header {
  text-align: center;
  padding: 20px 12px 8px;
}

.main-title {
  font-size: 3.5rem;
  font-weight: 900;
  margin: 0;
  color: #ff4747;
  text-shadow: 1px 1px 5px rgba(255, 255, 255, 0.5);
}

.section-description {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.68);
}

@media (max-width: 1024px) {
  .app-wrapper {
    /* On mobile, the menu is floating/hidden, so no margin needed */
    margin-left: 0; 
    /* padding-top: 80px; */ /* Room for the burger button at the top */
  }

  .main-title {
    font-size: 2.5rem;
  }
}
</style>
