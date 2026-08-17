import { describe, expect, it } from 'vitest'
import {
  catalogKind,
  catalogKindMatches,
  challengeBelongsToTrack,
  challengeCountLabel,
  trackLabelForExercise,
  trackSlugForExercise,
  type CatalogExercise,
} from '../utils/challenge-catalog'

const ts: CatalogExercise = {
  type: 'challenge',
  conceptId: '08c4fb6c-65d3-4a8e-9b7a-0748953947d2',
  concept: {
    slug: 'specification',
    name: 'Pin It Down',
    track: { slug: 'typescript', name: 'TypeScript' },
  },
}

const vue: CatalogExercise = {
  type: 'challenge',
  conceptId: '9ecdb748-aaaa-bbbb-cccc-dddddddddddd',
  concept: { slug: 'challenges', name: 'Challenges', track: { slug: 'vue', name: 'Vue.js' } },
}

const orphan: CatalogExercise = {
  type: 'challenge',
  conceptId: '7a827a70-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
}

describe('challengeBelongsToTrack', () => {
  it('does not treat a UUID prefix as a language slug', () => {
    // This is the live bug: conceptId.startsWith('typescript') is false for
    // every real row, so every chip other than All Tracks showed 0.
    expect(ts.conceptId.startsWith('typescript')).toBe(false)
    expect(challengeBelongsToTrack(ts, 'typescript')).toBe(true)
    expect(challengeBelongsToTrack(ts, 'vue')).toBe(false)
  })

  it('keeps All Tracks as the unfiltered list', () => {
    expect(challengeBelongsToTrack(ts, 'all')).toBe(true)
    expect(challengeBelongsToTrack(orphan, 'all')).toBe(true)
  })

  it('drops an exercise whose track is missing from a language filter', () => {
    expect(challengeBelongsToTrack(orphan, 'typescript')).toBe(false)
  })
})

describe('catalogKind', () => {
  it('splits tool, spec, and from-scratch work that share type=challenge', () => {
    expect(catalogKind(ts)).toBe('spec')
    expect(catalogKind(vue)).toBe('challenge')
    expect(
      catalogKind({
        type: 'challenge',
        conceptId: 'x',
        concept: { slug: 'tooling', track: { slug: 'go' } },
      })
    ).toBe('tool')
    expect(catalogKind(orphan)).toBe('other')
  })

  it('treats All as unfiltered and names a single challenge in the singular', () => {
    expect(catalogKindMatches(ts, 'all')).toBe(true)
    expect(catalogKindMatches(ts, 'spec')).toBe(true)
    expect(catalogKindMatches(ts, 'tool')).toBe(false)
    expect(challengeCountLabel(1)).toBe('1 challenge')
    expect(challengeCountLabel(2)).toBe('2 challenges')
  })
})

describe('trackLabelForExercise', () => {
  it('names the language, not the first UUID chunk', () => {
    expect(trackLabelForExercise(ts)).toBe('TypeScript')
    expect(trackLabelForExercise(vue)).toBe('Vue.js')
    expect(trackSlugForExercise(ts)).toBe('typescript')
    expect(ts.conceptId.split('-')[0]).not.toBe('TypeScript')
  })

  it('falls back to Challenge when the join is missing', () => {
    expect(trackLabelForExercise(orphan)).toBe('Challenge')
  })
})
