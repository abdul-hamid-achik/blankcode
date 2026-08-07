import { describe, expect, it } from 'vitest'
import { countWords, readingMinutes, sortPostsNewestFirst } from '~/utils/blog'

describe('countWords', () => {
  it('counts words in a bare string', () => {
    expect(countWords('three little words')).toBe(3)
  })

  it('ignores extra whitespace', () => {
    expect(countWords('  spaced   out\n\nwords ')).toBe(3)
  })

  it('walks a minimark tree (the v3 "minimal" body format)', () => {
    const body = {
      type: 'minimal',
      value: [
        ['h2', { id: 'first' }, 'A heading here'],
        ['p', {}, 'Some prose with ', ['strong', {}, 'bold words'], ' inside.'],
        ['pre', { language: 'ts' }, ['code', {}, 'const n = 1']],
      ],
    }
    // 'A heading here' (3) + 'Some prose with ' (3) + 'bold words' (2)
    // + ' inside.' (1) + 'const n = 1' (4) = 13
    expect(countWords(body)).toBe(13)
  })

  it('walks hast-style objects', () => {
    const body = {
      children: [
        { type: 'text', value: 'two words' },
        { children: [{ type: 'text', value: 'and three more' }] },
      ],
    }
    expect(countWords(body)).toBe(5)
  })

  it('returns zero for shapes it does not recognise', () => {
    expect(countWords(null)).toBe(0)
    expect(countWords(undefined)).toBe(0)
    expect(countWords(42)).toBe(0)
    expect(countWords({ unrelated: true })).toBe(0)
  })

  it('handles an element with no children', () => {
    expect(countWords(['img', { src: '/x.png' }])).toBe(0)
  })
})

describe('readingMinutes', () => {
  it('never reports zero minutes', () => {
    expect(readingMinutes('short')).toBe(1)
  })

  it('rounds to the nearest whole minute', () => {
    const words = Array.from({ length: 450 }, () => 'word').join(' ')
    expect(readingMinutes(words)).toBe(2)
  })
})

describe('sortPostsNewestFirst', () => {
  it('orders by date, newest first', () => {
    const sorted = sortPostsNewestFirst([
      { path: '/blog/a', date: '2026-01-01' },
      { path: '/blog/b', date: '2026-03-01' },
      { path: '/blog/c', date: '2026-02-01' },
    ])
    expect(sorted.map((p) => p.path)).toEqual(['/blog/b', '/blog/c', '/blog/a'])
  })

  it('breaks date ties by path so the order is deterministic', () => {
    const sorted = sortPostsNewestFirst([
      { path: '/blog/zeta', date: '2026-08-06' },
      { path: '/blog/alpha', date: '2026-08-06' },
    ])
    expect(sorted.map((p) => p.path)).toEqual(['/blog/alpha', '/blog/zeta'])
  })

  it('sorts a null date last instead of crashing', () => {
    const sorted = sortPostsNewestFirst([
      { path: '/blog/broken', date: null },
      { path: '/blog/ok', date: '2026-08-06' },
    ])
    expect(sorted[0]?.path).toBe('/blog/ok')
  })

  it('does not mutate its input', () => {
    const input = [
      { path: '/blog/a', date: '2026-01-01' },
      { path: '/blog/b', date: '2026-03-01' },
    ]
    sortPostsNewestFirst(input)
    expect(input[0]?.path).toBe('/blog/a')
  })
})
