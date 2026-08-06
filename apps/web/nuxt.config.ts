import tailwindcss from '@tailwindcss/vite'
import type { PluginOption } from 'vite'

export default defineNuxtConfig({
  modules: ['@nuxt/content', '@pinia/nuxt', '@nuxt/fonts'],

  // IBM Plex is the whole type system: Mono carries the display voice (the
  // product is literally code text), Sans carries prose. Self-hosted by
  // @nuxt/fonts so there is no CDN dependency at runtime.
  fonts: {
    families: [
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500, 600] },
      { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600] },
    ],
  },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss() as PluginOption],
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? '/api',
    },
  },

  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  routeRules: {
    '/': { ssr: true },
    '/tracks/**': { ssr: true },
    '/tutorials/**': { ssr: true },
    '/exercise/**': { ssr: false },
    '/dashboard': { ssr: false },
    '/settings': { ssr: false },
    '/progress': { ssr: false },
    '/login': { ssr: false },
    '/register': { ssr: false },
  },

  typescript: {
    strict: true,
  },

  compatibilityDate: '2024-11-01',
})
