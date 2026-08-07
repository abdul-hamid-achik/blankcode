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

  app: {
    head: {
      link: [
        // SVG first for anything modern; .ico is the fallback Safari and
        // Windows still ask for, and a 404 there is visible in every tab.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'apple-touch-icon', href: '/favicon.svg' },
      ],
      meta: [{ name: 'theme-color', content: '#0d1017' }],
    },
  },

  vite: {
    plugins: [tailwindcss() as PluginOption],
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? '/api',
      // Canonical origin for canonical tags, OG urls and the sitemap. Set this
      // per environment so a preview never claims to be the production site.
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://blankcode.dev',
    },
  },

  nitro: {
    // The Effect API is mounted at server/routes/api/[...].ts, so there is no
    // separate API process to proxy to — dev and production take the same path
    // through the same handler.
    vercel: {
      functions: {
        // Submissions execute inline in the request that creates them: 2-12s
        // for a warm sandbox, more when a snapshot is cold. The Vercel default
        // would cut a slow Rust run off mid-compile.
        maxDuration: 300,
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
