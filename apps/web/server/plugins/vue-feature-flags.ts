/**
 * Defines Vue's compile-time feature flags at runtime, for the server.
 *
 * Vue expects a bundler to substitute these identifiers via `define`. That
 * happens for everything the build compiles — but Nitro externalises Pinia into
 * the server bundle's own `node_modules` instead of bundling it, so Pinia's
 * code still contains a bare `__VUE_PROD_DEVTOOLS__`. The first `createPinia()`
 * on the server then dies with `ReferenceError: __VUE_PROD_DEVTOOLS__ is not
 * defined`. Build-time replacement cannot reach that file, because it is never
 * part of the build; a global can, since a bare identifier resolves through
 * `globalThis`.
 *
 * The names are assembled from pieces on purpose. The build's replacement is
 * plain text and does not stop at identifiers — writing
 * `globalThis.__VUE_PROD_DEVTOOLS__ ??= false` here compiles to
 * `globalThis.false ??= false`, a silent no-op that looks completely correct in
 * the source. Splitting the token is what keeps this file from being rewritten
 * into nothing.
 *
 * What made the original bug expensive to find is that the ReferenceError was
 * invisible. Nuxt's `applyPlugins` registers every plugin's `hooks` in one pass
 * *before* running any plugin's `setup`, so when Pinia's setup threw, its own
 * `app:rendered` hook still fired and failed on the `$pinia` that setup never
 * provided. Every server-rendered page returned that second error instead:
 *
 *   TypeError: Cannot read properties of undefined (reading 'state')
 *
 * Pages with `ssr: false` in `routeRules` were unaffected, which is why the
 * site looked half alive rather than plainly broken.
 */

const PREFIX = '__VUE_'
const SUFFIX = '__'

const FLAGS: ReadonlyArray<readonly [string, boolean]> = [
  [`${PREFIX}PROD_DEVTOOLS${SUFFIX}`, false],
  [`${PREFIX}OPTIONS_API${SUFFIX}`, true],
  [`${PREFIX}PROD_HYDRATION_MISMATCH_DETAILS${SUFFIX}`, false],
]

export default defineNitroPlugin(() => {
  const target = globalThis as unknown as Record<string, unknown>
  for (const [name, value] of FLAGS) {
    if (target[name] === undefined) target[name] = value
  }
})
