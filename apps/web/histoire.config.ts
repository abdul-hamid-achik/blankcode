import { fileURLToPath } from 'node:url'
import { HstVue } from '@histoire/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'histoire'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Histoire runs its own Vite server — it does NOT boot Nuxt. Anything a story
 * renders must therefore avoid Nuxt auto-imports and Nuxt-only components
 * (`NuxtLink`, `useRuntimeConfig`, ...). Presentational components take props,
 * so they work as-is; container components should be exercised in the app.
 */
export default defineConfig({
  plugins: [HstVue()],
  setupFile: './histoire.setup.ts',
  storyMatch: ['**/*.story.vue'],
  storyIgnored: ['**/node_modules/**', '**/dist/**', '**/.nuxt/**', '**/.output/**'],
  tree: {
    groups: [
      { id: 'ui', title: 'UI primitives' },
      { id: 'landing', title: 'Landing' },
      { id: 'exercise', title: 'Exercise' },
    ],
  },
  vite: {
    // histoire@1.0.0-beta.1 declares `vite ^7`; on Vite 8 its bundled Vue
    // plugin is not picked up, so register it (and Tailwind) explicitly.
    plugins: [vue(), tailwindcss()],
    // Nuxt normally provides these aliases; Histoire's Vite server does not.
    resolve: {
      alias: { '~': root, '@': root },
    },
    server: {
      port: 6006,
    },
  },
})
