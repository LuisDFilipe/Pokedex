import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PokedexView from '../views/PokedexView.vue'
import StatsView from '../views/StatsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  linkActiveClass: 'active',
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        title: 'Home',
        description: 'Browse the project and jump into your collection.',
      },
    },
    {
      path: '/pokedex',
      name: 'pokedex',
      component: PokedexView,
      meta: {
        title: 'Pokedex',
        description: 'Track forms, filter the dex, and mark your collection.',
      },
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('../views/GameView.vue'),
      meta: {
        title: 'Pokemon Game',
        description: 'Walk the map and prototype wild encounter ideas.',
      },
    },
    {
      path: '/stats',
      name: 'stats',
      component: StatsView,
      meta: {
        title: 'Stats',
        description: 'See collection completion by generation, type, and form.',
      },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: {
        title: 'About',
        description: 'Project details, scope, and current release notes.',
      },
    },
  ],
})

export default router
