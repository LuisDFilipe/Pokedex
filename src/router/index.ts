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
        description: 'Home of the Pokedex App.'
      }
    },
    {
      path: '/pokedex',
      name: 'pokedex',
      component: PokedexView,
      meta: { 
        title: 'Pokedex',
        description: 'Pokedex of the Pokedex App.'
      }
    },
    {
      path: '/stats',
      name: 'stats',
      component: StatsView,
      meta: { 
        title: 'Stats',
        description: 'Stats of the Pokedex App.'
      }
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
      meta: { 
        title: 'About',
        //description: 'About the Pokedex App.',
        description: 'About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App. About the Pokedex App.'
      }
    },
  ],
})

export default router
