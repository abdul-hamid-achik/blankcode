import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  slugify,
  generateId,
  sleep,
  chunk,
  pick,
  omit,
  isNonNullable,
  groupBy,
  debounce,
  throttle,
  formatDuration,
  truncate,
  escapeHtml,
  parseIntSafe,
  clamp,
} from '../utils/index.js'

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })

  it('trims whitespace', () => {
    expect(slugify('  hello world  ')).toBe('hello-world')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('hello---world')).toBe('hello-world')
  })

  it('removes leading and trailing hyphens', () => {
    expect(slugify('-hello world-')).toBe('hello-world')
  })

  it('handles underscores', () => {
    expect(slugify('hello_world')).toBe('hello-world')
  })
})

describe('generateId', () => {
  it('generates a valid UUID', () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

describe('sleep', () => {
  it('waits for specified duration', async () => {
    const start = Date.now()
    await sleep(50)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(45)
  })
})

describe('chunk', () => {
  it('splits array into chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('handles exact division', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('handles chunk size larger than array', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]])
  })

  it('handles empty array', () => {
    expect(chunk([], 2)).toEqual([])
  })
})

describe('pick', () => {
  it('picks specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 })
  })

  it('ignores non-existent keys', () => {
    const obj = { a: 1, b: 2 }
    expect(pick(obj, ['a', 'c' as keyof typeof obj])).toEqual({ a: 1 })
  })

  it('returns empty object for empty keys', () => {
    const obj = { a: 1, b: 2 }
    expect(pick(obj, [])).toEqual({})
  })
})

describe('omit', () => {
  it('omits specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 })
  })

  it('returns copy when omitting nothing', () => {
    const obj = { a: 1, b: 2 }
    const result = omit(obj, [])
    expect(result).toEqual({ a: 1, b: 2 })
    expect(result).not.toBe(obj)
  })
})

describe('isNonNullable', () => {
  it('returns true for non-null values', () => {
    expect(isNonNullable(0)).toBe(true)
    expect(isNonNullable('')).toBe(true)
    expect(isNonNullable(false)).toBe(true)
    expect(isNonNullable({})).toBe(true)
  })

  it('returns false for null', () => {
    expect(isNonNullable(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isNonNullable(undefined)).toBe(false)
  })
})

describe('groupBy', () => {
  it('groups by key function', () => {
    const items = [
      { type: 'a', value: 1 },
      { type: 'b', value: 2 },
      { type: 'a', value: 3 },
    ]
    const result = groupBy(items, (item) => item.type)
    expect(result).toEqual({
      a: [{ type: 'a', value: 1 }, { type: 'a', value: 3 }],
      b: [{ type: 'b', value: 2 }],
    })
  })

  it('handles empty array', () => {
    expect(groupBy([], () => 'key')).toEqual({})
  })
})

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays function execution', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    vi.advanceTimersByTime(50)
    debounced()
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls function immediately', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('blocks subsequent calls within delay', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled()
    throttled()
    throttled()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('allows calls after delay', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled()
    vi.advanceTimersByTime(100)
    throttled()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms')
  })

  it('formats seconds', () => {
    expect(formatDuration(2500)).toBe('2.5s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s')
  })
})

describe('truncate', () => {
  it('does not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
  })

  it('uses custom suffix', () => {
    expect(truncate('hello world', 8, '…')).toBe('hello w…')
  })
})

describe('escapeHtml', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('escapes ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })
})

describe('parseIntSafe', () => {
  it('parses valid integers', () => {
    expect(parseIntSafe('42', 0)).toBe(42)
  })

  it('returns default for undefined', () => {
    expect(parseIntSafe(undefined, 10)).toBe(10)
  })

  it('returns default for invalid strings', () => {
    expect(parseIntSafe('not a number', 10)).toBe(10)
  })
})

describe('clamp', () => {
  it('returns value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps to maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
})
