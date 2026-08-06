import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Unit tests for framework-free logic: pure helpers, blank reconstruction,
 * component rendering, status mapping. Anything that needs Nuxt auto-imports
 * or a live API belongs in the external cairntrace end-to-end suite.
 */
export default defineConfig({
  // Vitest runs its own Vite instance, so `.vue` SFCs need the plugin here too.
  // Vitest bundles Vite 7 while the app builds on Vite 8; the plugin is
  // runtime-compatible, only the `Plugin` types differ.
  plugins: [vue() as unknown as ViteUserConfig['plugins']],
  resolve: {
    alias: {
      '~': root,
      '@': root,
    },
  },
  test: {
    globals: false,
    environment: 'happy-dom',
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', '.nuxt/**', '.output/**'],
  },
})
