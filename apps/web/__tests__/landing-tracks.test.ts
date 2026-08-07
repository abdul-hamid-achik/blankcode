import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHALLENGE_COUNT, EXERCISE_COUNT, LANDING_TRACKS } from '../utils/landing-tracks'

/**
 * The landing page links straight to `/tracks/{slug}` and states counts as
 * facts. Before this test the showcase advertised a JavaScript track that had
 * no content directory, so the chip led to an empty page. Pin every slug and
 * every number to `content/tracks/` so the page cannot drift from the corpus.
 */

// Vitest roots at `apps/web`, so the monorepo root is two levels up.
const webRoot = process.cwd()
const contentTracksDir = resolve(webRoot, '../../content/tracks')

function trackSlugsOnDisk(): string[] {
  return readdirSync(contentTracksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function exerciseFiles(slug: string): string[] {
  const files = readdirSync(`${contentTracksDir}/${slug}`, { recursive: true }) as string[]
  return files.filter((file) => file.endsWith('.md'))
}

describe('landing page track list', () => {
  it('advertises exactly the tracks that have content', () => {
    const advertised = LANDING_TRACKS.map((track) => track.slug).sort()
    expect(advertised).toEqual(trackSlugsOnDisk())
  })

  it('does not advertise a track with no exercises', () => {
    for (const track of LANDING_TRACKS) {
      expect(
        exerciseFiles(track.slug).length,
        `track "${track.slug}" has no exercises`
      ).toBeGreaterThan(0)
    }
  })

  it('states the exercise count each track actually has', () => {
    for (const track of LANDING_TRACKS) {
      expect(track.exercises, `count drifted for "${track.slug}"`).toBe(
        exerciseFiles(track.slug).length
      )
    }
  })

  it('states the challenge count that is on disk', () => {
    const onDisk = trackSlugsOnDisk()
      .flatMap((slug) => exerciseFiles(slug))
      .filter((file) => file.includes('challenges')).length
    expect(CHALLENGE_COUNT).toBe(onDisk)
  })

  /**
   * The totals are rendered from the module rather than typed out, so there is
   * no second place for them to drift. Guard that they stay derived.
   */
  it('derives the totals instead of hardcoding them', () => {
    expect(EXERCISE_COUNT).toBe(LANDING_TRACKS.reduce((sum, track) => sum + track.exercises, 0))

    const source = readFileSync(resolve(webRoot, 'utils/landing-tracks.ts'), 'utf-8')
    expect(source).toContain('LANDING_TRACKS.reduce')

    for (const file of [
      'components/landing/language-showcase.vue',
      'components/landing/practice-hero.vue',
    ]) {
      const component = readFileSync(resolve(webRoot, file), 'utf-8')
      expect(component, `${file} should render counts from ~/utils/landing-tracks`).toContain(
        'landing-tracks'
      )
      expect(component).not.toMatch(/\b\d+ languages?\b/)
      expect(component).not.toMatch(/\b\d+ exercises?\b/)
    }
  })
})
