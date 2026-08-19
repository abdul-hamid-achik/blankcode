import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Nuxt treats `foo.vue` next to a `foo/` directory as the parent page of
 * everything inside `foo/`. The children only render if that parent hosts
 * `<NuxtPage>`. We used `pages/tracks/[trackSlug]/[conceptSlug].vue` beside
 * `[conceptSlug]/[exerciseSlug].vue`, so `/tracks/python/tooling/py-tool-001`
 * rendered the concept list and ignored the third segment. Clicking a lesson
 * looked like a no-op; opening it in a new tab showed the same list.
 */

const webRoot = process.cwd()
const pagesRoot = join(webRoot, 'pages')

function collectSwallowingPages(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSwallowingPages(full, found)
      continue
    }
    if (!entry.endsWith('.vue')) continue
    const siblingDir = full.slice(0, -'.vue'.length)
    if (existsSync(siblingDir) && statSync(siblingDir).isDirectory()) {
      found.push(relative(pagesRoot, full))
    }
  }
  return found
}

const read = (rel: string) => readFileSync(join(webRoot, rel), 'utf-8')

describe('track exercise routes are reachable', () => {
  it('does not let a page file swallow a sibling directory of child routes', () => {
    expect(collectSwallowingPages(pagesRoot)).toEqual([])
  })

  it('lists a concept at [conceptSlug]/index.vue and the exercise as its sibling', () => {
    const concept = join(pagesRoot, 'tracks/[trackSlug]/[conceptSlug]/index.vue')
    const exercise = join(pagesRoot, 'tracks/[trackSlug]/[conceptSlug]/[exerciseSlug].vue')
    expect(existsSync(concept), 'concept list must live at [conceptSlug]/index.vue').toBe(true)
    expect(
      existsSync(exercise),
      'exercise page must live at [conceptSlug]/[exerciseSlug].vue'
    ).toBe(true)
    expect(existsSync(join(pagesRoot, 'tracks/[trackSlug]/[conceptSlug].vue'))).toBe(false)
  })

  it('the concept list still points each row at the three-segment exercise URL', () => {
    const source = read('pages/tracks/[trackSlug]/[conceptSlug]/index.vue')
    expect(source).toContain('exerciseHref')
    expect(source).toContain('concept: { slug: conceptSlug, track: { slug: trackSlug } }')
  })
})

describe('track progress is fetched with the cookie, not after auth hydrates', () => {
  it('the track index loads the summary during the render', () => {
    const source = read('pages/tracks/index.vue')
    expect(source).toContain('/api/progress/summary')
    expect(source).toContain('useAsyncData')
    expect(source).toContain('Authorization')
    expect(source).not.toContain('if (authStore.isAuthenticated) loadSummary()')
  })

  it('the track detail page reads completedExercises, not a missing mastery row', () => {
    const source = read('pages/tracks/[trackSlug]/index.vue')
    expect(source).toContain('/api/progress/tracks/')
    expect(source).toContain('useAsyncData')
    expect(source).toContain('completedExercises')
    expect(source).not.toContain('row.mastery?.exercisesCompleted')
  })

  it('the concept list loads completed ids during the render', () => {
    const source = read('pages/tracks/[trackSlug]/[conceptSlug]/index.vue')
    expect(source).toContain('/api/progress/completed')
    expect(source).toContain('useAsyncData')
    expect(source).toContain('Authorization')
  })
})
