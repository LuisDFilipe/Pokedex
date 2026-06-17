import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3000,
    strictPort: true
  },
  preview: {
    port: 3001,
    strictPort: true
  },
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'The Pokédex',
        short_name: 'The Pokédex',
        description: 'A personal Pokémon tracker and collection logger.',
        theme_color: '#101010',
        background_color: '#101010',
        display: 'standalone',
        icons: [
          {
            src: 'icon_192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon_512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon_192_maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'icon_512_maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,ts}']
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
