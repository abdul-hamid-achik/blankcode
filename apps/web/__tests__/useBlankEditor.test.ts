import type { BlankRegionInStarter } from '@blankcode/shared'
import { describe, expect, it } from 'vitest'
import { extractBlankValues, reconstructCode } from '~/composables/useBlankEditor'

/**
 * These two functions are the round-trip that keeps a user's work alive: the
 * editor reconstructs full source from (starter + blank values) before
 * submitting, and re-extracts the values when a draft is restored. A bug here
 * silently corrupts saved work, so the round-trip is pinned down here.
 */

function blank(id: string, from: number, to: number, placeholder: string): BlankRegionInStarter {
  return { id, from, to, placeholder } as BlankRegionInStarter
}

// `const a = ___; const b = ___;`
//           ^10 ^13         ^25 ^28
const STARTER = 'const a = ___; const b = ___;'
const BLANKS = [blank('b1', 10, 13, '___'), blank('b2', 25, 28, '___')]

describe('reconstructCode', () => {
  it('substitutes every blank value at its recorded offsets', () => {
    const values = new Map([
      ['b1', '1'],
      ['b2', '2'],
    ])
    expect(reconstructCode(STARTER, BLANKS, values)).toBe('const a = 1; const b = 2;')
  })

  it('falls back to the placeholder for blanks the user left untouched', () => {
    const values = new Map([['b1', '1']])
    expect(reconstructCode(STARTER, BLANKS, values)).toBe('const a = 1; const b = ___;')
  })

  it('stays correct when replacements change the document length', () => {
    const values = new Map([
      ['b1', 'someVeryLongExpression()'],
      ['b2', 'x'],
    ])
    expect(reconstructCode(STARTER, BLANKS, values)).toBe(
      'const a = someVeryLongExpression(); const b = x;'
    )
  })

  it('is insensitive to the order blanks are given in', () => {
    const values = new Map([
      ['b1', 'AAAA'],
      ['b2', 'B'],
    ])
    const forwards = reconstructCode(STARTER, BLANKS, values)
    const backwards = reconstructCode(STARTER, [...BLANKS].reverse(), values)
    expect(backwards).toBe(forwards)
  })

  it('returns the starter unchanged when there are no blanks', () => {
    expect(reconstructCode(STARTER, [], new Map())).toBe(STARTER)
  })
})

describe('extractBlankValues', () => {
  it('returns an empty map when the exercise has no blanks', () => {
    expect(extractBlankValues('anything', STARTER, []).size).toBe(0)
  })

  it('recovers the values a user typed from their saved code', () => {
    const values = extractBlankValues('const a = 1; const b = 2;', STARTER, BLANKS)
    expect(values.get('b1')).toBe('1')
    expect(values.get('b2')).toBe('2')
  })

  it('round-trips values of differing lengths', () => {
    const original = new Map([
      ['b1', 'computeSomething(x)'],
      ['b2', 'y'],
    ])
    const saved = reconstructCode(STARTER, BLANKS, original)
    const recovered = extractBlankValues(saved, STARTER, BLANKS)
    expect(recovered.get('b1')).toBe('computeSomething(x)')
    expect(recovered.get('b2')).toBe('y')
  })

  it('recovers an empty value for a blank the user cleared', () => {
    const saved = reconstructCode(
      STARTER,
      BLANKS,
      new Map([
        ['b1', ''],
        ['b2', '2'],
      ])
    )
    const recovered = extractBlankValues(saved, STARTER, BLANKS)
    expect(recovered.get('b1')).toBe('')
    expect(recovered.get('b2')).toBe('2')
  })

  it('handles a blank that runs to the end of the document', () => {
    const starter = 'return ___'
    const blanks = [blank('tail', 7, 10, '___')]
    const saved = reconstructCode(starter, blanks, new Map([['tail', 'value + 1']]))
    expect(extractBlankValues(saved, starter, blanks).get('tail')).toBe('value + 1')
  })

  /**
   * Regression: this used to truncate to `g(1)` minus the closer, because the
   * old algorithm committed to the first `)` it found. Drafts are saved as
   * reconstructed code and re-extracted on load, so the truncation compounded
   * on every reload and silently destroyed real work.
   */
  it('keeps a value that contains the following fixed segment intact', () => {
    const starter = 'f(___)'
    const blanks = [blank('arg', 2, 5, '___')]
    const saved = 'f(g(1))'
    expect(extractBlankValues(saved, starter, blanks).get('arg')).toBe('g(1)')
  })

  it('is not fooled when the following fixed segment is longer than one char', () => {
    const starter = 'f(___);'
    const blanks = [blank('arg', 2, 5, '___')]
    expect(extractBlankValues('f(g(1));', starter, blanks).get('arg')).toBe('g(1)')
  })

  it('survives repeated save/restore round trips without drifting', () => {
    const starter = 'const a = ___; const b = ___;'
    const blanks = [blank('b1', 10, 13, '___'), blank('b2', 25, 28, '___')]
    const original = new Map([
      ['b1', 'f(x);'],
      ['b2', 'g(y);'],
    ])

    // Simulate the draft loop: reconstruct -> save -> reload -> extract.
    let values = original
    for (let i = 0; i < 5; i++) {
      const saved = reconstructCode(starter, blanks, values)
      values = extractBlankValues(saved, starter, blanks)
    }

    expect(values.get('b1')).toBe('f(x);')
    expect(values.get('b2')).toBe('g(y);')
  })

  it('recovers values that contain regex metacharacters in the fixed text', () => {
    const starter = 'if (x) { return ___ }'
    const blanks = [blank('r', 16, 19, '___')]
    const saved = 'if (x) { return a || b }'
    expect(extractBlankValues(saved, starter, blanks).get('r')).toBe('a || b')
  })

  it('recovers a multi-line value', () => {
    const starter = 'fn() {\n  ___\n}'
    const blanks = [blank('body', 9, 12, '___')]
    const saved = 'fn() {\n  const a = 1\n  return a\n}'
    expect(extractBlankValues(saved, starter, blanks).get('body')).toBe('const a = 1\n  return a')
  })

  /**
   * A stale draft written against an older version of the exercise no longer
   * matches the starter's fixed text. Half-recovering it would splice the
   * user's answers into the wrong blanks, so start clean instead.
   */
  it('returns nothing when the saved code no longer matches the starter', () => {
    const values = extractBlankValues('totally different text', STARTER, BLANKS)
    expect(values.size).toBe(0)
  })
})
