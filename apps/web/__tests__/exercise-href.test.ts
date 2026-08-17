import { describe, expect, it } from 'vitest'
import { exerciseHref, FIRST_SITTING_HREF } from '../utils/exercise-href'

describe('exerciseHref', () => {
  it('prefers the track/concept/slug path when the join is present', () => {
    expect(
      exerciseHref({
        id: 'uuid-1',
        slug: 'ts-basics-001',
        concept: { slug: 'basics', track: { slug: 'typescript' } },
      })
    ).toBe('/tracks/typescript/basics/ts-basics-001')
  })

  it('falls back to the UUID route when the join is missing', () => {
    expect(exerciseHref({ id: 'uuid-1' })).toBe('/exercise/uuid-1')
    expect(exerciseHref({ id: 'uuid-1', slug: 'ts-basics-001' })).toBe('/exercise/uuid-1')
  })

  it('starts a new account on the first TypeScript blank', () => {
    expect(FIRST_SITTING_HREF).toBe('/tracks/typescript/basics/ts-basics-001')
  })
})
