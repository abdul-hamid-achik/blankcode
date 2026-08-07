import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `server/plugins/vue-feature-flags.ts` is the reason server-rendered pages
 * render at all: without it, the externalised copy of Pinia hits a bare
 * `__VUE_PROD_DEVTOOLS__` and every SSR route returns 500.
 *
 * These are source-level assertions because the failure is a *silent rewrite*.
 * The first version of that plugin looked correct and did nothing: the build's
 * text replacement turned `globalThis.__VUE_PROD_DEVTOOLS__ ??= false` into
 * `globalThis.false ??= false`. Nothing about the source revealed that, and no
 * runtime test of the source (as opposed to the bundle) could catch it either —
 * the bug exists only after the build.
 */

const PLUGIN = join(process.cwd(), 'server/plugins/vue-feature-flags.ts')
const source = readFileSync(PLUGIN, 'utf-8')

// Assembled the same way the plugin does, so this file cannot be rewritten into
// a test that trivially passes.
const PREFIX = '__VUE_'
const SUFFIX = '__'

describe('vue feature flag plugin', () => {
  it('never writes a flag name as one literal token', () => {
    // A whole token here is the bug: the build would replace it with the
    // flag's *value*, and the plugin would silently stop setting anything.
    for (const name of ['PROD_DEVTOOLS', 'OPTIONS_API', 'PROD_HYDRATION_MISMATCH_DETAILS']) {
      const whole = `${PREFIX}${name}${SUFFIX}`
      // The doc comment names one of them when explaining the bug; code must not.
      const code = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('/*'))
        .join('\n')
      expect(code, `${whole} appears verbatim in code and will be rewritten`).not.toContain(whole)
    }
  })

  it('sets the three flags Vue expects a bundler to define', () => {
    expect(source).toContain('PROD_DEVTOOLS')
    expect(source).toContain('OPTIONS_API')
    expect(source).toContain('PROD_HYDRATION_MISMATCH_DETAILS')
  })

  it('assigns through a computed key, so replacement cannot reach it', () => {
    expect(source).toMatch(/target\[name\]\s*=\s*value/)
  })

  it('runs as a nitro plugin, which starts before the first render', () => {
    expect(source).toContain('defineNitroPlugin')
  })

  it('does not overwrite a flag the runtime already defined', () => {
    expect(source).toContain('=== undefined')
  })
})
