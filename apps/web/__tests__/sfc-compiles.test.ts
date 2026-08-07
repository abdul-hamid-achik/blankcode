import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { compileTemplate, parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

/**
 * Every `.vue` file must survive Vue's SFC + template compiler.
 *
 * This exists because `vue-tsc` does NOT catch malformed template expressions:
 * oxfmt once reflowed `@click="a(); b = false"` into two semicolon-less lines,
 * which typecheck happily accepted and only `nuxt build` rejected. A formatter
 * that can emit non-compiling templates needs a cheap guard in the test suite.
 */

const webRoot = process.cwd()
const SEARCH_DIRS = ['components', 'pages', 'layouts']
const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', '.histoire', 'dist'])

function collectVueFiles(dir: string, found: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir, { encoding: 'utf-8' })
  } catch {
    return found
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectVueFiles(full, found)
    } else if (entry.endsWith('.vue')) {
      found.push(full)
    }
  }
  return found
}

const vueFiles = [
  ...SEARCH_DIRS.flatMap((dir) => collectVueFiles(join(webRoot, dir))),
  join(webRoot, 'app.vue'),
].filter((file) => {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
})

describe('Vue SFCs compile', () => {
  it('finds the component files to check', () => {
    expect(vueFiles.length).toBeGreaterThan(10)
  })

  it.each(vueFiles.map((file) => [relative(webRoot, file), file]))('%s', (_name, file) => {
    const source = readFileSync(file, 'utf-8')
    const { descriptor, errors } = parse(source, { filename: file })
    expect(errors, `SFC parse errors in ${file}`).toEqual([])

    if (descriptor.template) {
      const compiled = compileTemplate({
        source: descriptor.template.content,
        filename: file,
        id: file,
      })
      expect(compiled.errors, `template compile errors in ${file}`).toEqual([])
    }
  })
})

/**
 * A review exercise hands the learner code that looks finished and is wrong.
 * If the page does not say so, the editor is indistinguishable from a stub to
 * complete, and nobody goes looking for the defect — which makes the exercise
 * measure nothing.
 */
describe('review exercises announce themselves', () => {
  const page = readFileSync(join(process.cwd(), 'pages/exercise/[exerciseId].vue'), 'utf-8')
  const store = readFileSync(join(process.cwd(), 'stores/exercise.ts'), 'utf-8')

  it('the store can tell a review from the other types', () => {
    expect(store).toContain("exercise.value?.type === 'review'")
    expect(store).toContain('isReviewMode')
  })

  it('the page warns the code is wrong', () => {
    expect(page).toContain('exerciseStore.isReviewMode')
    expect(page).toContain('This code is wrong')
  })

  it('says the grading tests are hidden', () => {
    // Without this the learner assumes the visible tests are the grade, which
    // is the exact belief the exercise exists to break.
    expect(page).toMatch(/graded on tests\s+you\s+cannot see/)
  })

  it('claims nothing that is not true of every review', () => {
    // Some reviews ship a passing suite the learner is meant to distrust;
    // others fail visibly with a misleading error. A banner asserting the
    // first would be a lie on the second, and the page cannot tell them apart.
    const banner = page.slice(page.indexOf('This code is wrong'))
    expect(banner.slice(0, 400)).not.toContain('passes the tests')
  })
})

/**
 * `vue-router` is declared as a direct dependency even though Nuxt brings it
 * in. Without that, it lives only under nuxt's own node_modules, and vue-tsc —
 * which resolves the volar plugin relative to itself, not to the project —
 * cannot find `vue-router/volar/sfc-route-blocks`. Every typecheck then printed
 * a module-not-found stack that had nothing to do with the code being checked.
 */
describe('vue-router is declared, not just inherited', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as {
    dependencies: Record<string, string>
  }

  it('is a direct dependency', () => {
    expect(pkg.dependencies['vue-router']).toBeDefined()
  })

  it('is not pinned away from the version nuxt resolves', () => {
    // A second copy would be the CodeMirror bug again: two routers, one of
    // which the app is not using.
    expect(pkg.dependencies['vue-router']).toMatch(/^\^5\./)
  })
})

/**
 * A page that renders "not found" with a 200 is a soft-404: it tells a crawler
 * the URL is a valid page, so every typo becomes an indexable one. That matters
 * more now that the site publishes a sitemap and canonical tags.
 *
 * Only pages whose data resolves during the server render can answer correctly.
 * `/tracks/[trackSlug]` fetches from the client, so it still answers 200 for a
 * slug that does not exist — fixing that means moving its data flow to the
 * server, which is a real change rather than a line.
 */
describe('missing resources are real 404s', () => {
  it.each([
    ['pages/blog/[...slug].vue', 'Post not found'],
    ['pages/tutorials/[...slug].vue', 'Tutorial not found'],
    ['pages/paths/[pathSlug].vue', 'Path not found'],
  ])('%s throws a 404', (file, message) => {
    const source = readFileSync(join(process.cwd(), file), 'utf-8')
    expect(source).toContain('statusCode: 404')
    expect(source).toContain(message)
    // `fatal` is what makes Nuxt render the error page with the status rather
    // than swallowing it into the current one.
    expect(source).toContain('fatal: true')
  })

  it('the paths page checks static data rather than waiting for a request', () => {
    const source = readFileSync(join(process.cwd(), 'pages/paths/[pathSlug].vue'), 'utf-8')
    expect(source).toContain('LEARNING_PATHS.some')
  })
})

/**
 * The track pages are what someone searching "rust exercises" would land on.
 * They used to fetch in `onMounted`, so the server rendered a spinner: 8kB of
 * markup with no track name and no concepts. `routeRules` said `ssr: true` for
 * this route and the data flow was quietly ignoring it.
 */
describe('track pages render on the server', () => {
  const page = readFileSync(join(process.cwd(), 'pages/tracks/[trackSlug]/index.vue'), 'utf-8')

  it('fetches during the render, not on mount', () => {
    expect(page).toContain('useAsyncData')
    // The call, not the word — the comment above the fix explains what it used
    // to do, and matching that would fail on the explanation rather than the code.
    expect(page).not.toContain('onMounted(')
  })

  it('uses $fetch, which works on the server', () => {
    // `useApi` builds a relative URL and calls `fetch` directly — fine in a
    // browser, impossible in Node.
    expect(page).toContain('$fetch')
    expect(page).not.toContain('useApi()')
  })

  it('404s an unknown slug from the static list', () => {
    expect(page).toContain('TRACK_SLUGS.includes')
    expect(page).toContain('statusCode: 404')
  })

  it('carries its own title and description', () => {
    expect(page).toContain('useSeoMeta')
  })

  it('is listed in the sitemap now that it has content', () => {
    const sitemap = readFileSync(join(process.cwd(), 'server/routes/sitemap.xml.ts'), 'utf-8')
    expect(sitemap).toContain('TRACK_SLUGS.map')
  })
})
