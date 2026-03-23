<script setup>
import { useRoute } from 'vue-router'
import NavBarComponent from './components/NavBarComponent.vue'

const route = useRoute()
</script>

<template>
  <div class="app-wrapper">
    <header class="page-header">
      <h1 class="main-title">
        {{ route.meta.title }} <span class="highlight">{{ route.meta.highlight }}</span>
      </h1>
      <p class="section-description">
        {{ route.meta.description }}
      </p>
    </header>

    <NavBarComponent />
    
    <main class="content-area">
      <router-view />
    </main>
  </div>
</template>

<style>
body {
  margin: 0;
  background-color: #000;
  color: white;
  font-family: Arial, sans-serif;
}

.app-wrapper {
  display: flex;
  flex-direction: column; /* Stack header, nav, and content vertically */
  align-items: center;
  min-height: 100vh;
}

.page-header {
  text-align: center;
}

.main-title {
  font-size: 3.5rem;
  font-weight: 900;
  margin: 0;
  color: #ff4747;
  text-shadow: 1px 1px 5px rgba(255, 255, 255, 0.5);
}

.content-area {
  width: 100%;
  max-width: 1200px;
  text-align: center;
}
</style>