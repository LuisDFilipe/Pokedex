<script setup>
import { useRoute } from 'vue-router'
import MenuComponent from './components/MenuComponent.vue'

const route = useRoute()
</script>

<template>
  <div class="app-wrapper">
    <header class="page-header">
      <h1 class="main-title">
        {{ route.meta.title }} <span class="highlight">{{ route.meta.highlight }}</span>
      </h1>
      <!-- <p class="section-description">
        {{ route.meta.description }}
      </p> -->
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
  background-color: #000;
  color: white;
  font-family: Arial, sans-serif;
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
}

.main-title {
  font-size: 3.5rem;
  font-weight: 900;
  margin: 0;
  color: #ff4747;
  text-shadow: 1px 1px 5px rgba(255, 255, 255, 0.5);
}

@media (max-width: 1024px) {
  .app-wrapper {
    /* On mobile, the menu is floating/hidden, so no margin needed */
    margin-left: 0; 
    padding-top: 80px; /* Room for the burger button at the top */
  }
}
</style>