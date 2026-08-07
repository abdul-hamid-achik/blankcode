/*
 * Temporary instrumentation for the production-only SSR failure.
 *
 * Every server-rendered page returns 500 with
 *   TypeError: Cannot read properties of undefined (reading 'state')
 *   at app:rendered
 * which is Pinia's hook reading `nuxtApp.$pinia`. That hook is a symptom, not
 * the cause: Nuxt registers every plugin's `hooks` in one pass *before* it runs
 * any plugin's `setup` (see `applyPlugins`), so when something earlier throws,
 * Pinia's setup is skipped while its hook still fires — and the real error is
 * replaced by this one on the way out.
 *
 * This plugin does not change behaviour. It runs after Pinia's and reports
 * whether the plugin chain got that far, and prints any error Nuxt is about to
 * swallow. Delete it once the cause is known.
 */
export default defineNuxtPlugin({
  name: 'blankcode:diagnose',
  enforce: 'post',

  setup(nuxtApp) {
    console.log('[diag] plugin chain reached diagnose; $pinia present:', Boolean(nuxtApp.$pinia))
  },

  hooks: {
    'app:created'() {
      console.log('[diag] app:created')
    },
    'app:error'(error: unknown) {
      const e = error as { message?: string; stack?: string; cause?: unknown }
      console.error('[diag] app:error message:', e?.message)
      console.error('[diag] app:error stack:', e?.stack)
      if (e?.cause) console.error('[diag] app:error cause:', String(e.cause))
    },
    'app:rendered'() {
      console.log('[diag] app:rendered reached (before pinia hook)')
    },
  },
})
