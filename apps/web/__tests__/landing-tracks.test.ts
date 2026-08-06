import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The landing page links straight to `/tracks/{slug}`. Before this test the
 * showcase advertised a JavaScript track that had no content directory, so the
 * chip led to an empty page. Pin the two lists together.
 */

// Vitest roots at `apps/web`, so the monorepo root is two levels up.
const webRoot = process.cwd()
const contentTracksDir = resolve(webRoot, '../../content/tracks')
const landingDir = resolve(webRoot, 'components/landing')

const showcasePath = resolve(landingDir, 'language-showcase.vue')

function trackSlugsOnDisk(): string[] {
  return readdirSync(contentTracksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function showcaseSlugs(): string[] {
  const source = readFileSync(showcasePath, 'utf-8')
  return [...source.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1] as string).sort()
}

describe('landing page track list', () => {
  it('advertises exactly the tracks that have content', () => {
    expect(showcaseSlugs()).toEqual(trackSlugsOnDisk())
  })

  it('does not advertise a track with no exercises', () => {
    for (const slug of showcaseSlugs()) {
      const files = readdirSync(`${contentTracksDir}/${slug}`, { recursive: true }) as string[]
      const exercises = files.filter((f) => f.endsWith('.md'))
      expect(exercises.length, `track "${slug}" has no exercises`).toBeGreaterThan(0)
    }
  })

  /**
   * The count is rendered from `languages.length` rather than typed out, so
   * there is no second place for it to drift. Guard that it stays derived.
   */
  it('derives the language count instead of hardcoding it', () => {
    const source = readFileSync(showcasePath, 'utf-8')
    expect(source).toContain('languages.length')
    expect(source).not.toMatch(/\b6 languages\b/)
  })
})
