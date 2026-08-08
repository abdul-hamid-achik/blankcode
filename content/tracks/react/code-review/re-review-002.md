---
slug: re-review-002
title: 'Review: a countdown stuck one second in'
description: The countdown hook below passes its test. Watch it for three seconds and it is still showing the same number. A classic closure bug — find where time froze.
difficulty: intermediate
type: review
hints:
  - The effect runs once. The function inside setInterval was created once. What value of `seconds` does that function hold, forever?
  - The shipped test advances the clock exactly one second. Run the arithmetic for the second tick yourself.
  - setSeconds can receive a value, or something better. The something better is the fix.
tags:
  - code-review
  - hooks
  - closures
---

You asked a model for a countdown hook: give it a number of seconds, get back
the seconds remaining, ticking down once per second and stopping at zero. It
produced this, with a test. The test passes.

The countdown ticks exactly once and freezes. The interval callback was
created during the first render, closed over that render's `seconds`, and
computes `start - 1` from it forever — every tick after the first sets the
same value. The shipped test advances the clock exactly one second, which is
the one duration for which a frozen countdown and a working one are
indistinguishable.

Find the defect and fix it. You are graded on tests you cannot see.

```typescript
import { useEffect, useState } from 'react'

/**
 * Counts down from `start` once per second, stopping at zero.
 */
export function useCountdown(start: number): number {
  const [seconds, setSeconds] = useState(start)

  useEffect(() => {
    const id = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return seconds
}
```

## The tests it came with

This passes. One second is exactly the window in which the bug is invisible.

```typescript
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('ticks down after a second', () => {
    const { result } = renderHook(() => useCountdown(10))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(9)
  })
})
```

## Tests

```typescript
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './solution'

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts at the given value', () => {
    const { result } = renderHook(() => useCountdown(10))
    expect(result.current).toBe(10)
  })

  it('ticks down after a second', () => {
    const { result } = renderHook(() => useCountdown(10))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(9)
  })

  it('keeps ticking on later seconds', () => {
    // The second tick is where the frozen closure shows: a countdown reading
    // stale state computes start - 1 every time.
    const { result } = renderHook(() => useCountdown(10))
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current).toBe(7)
  })

  it('stops at zero', () => {
    const { result } = renderHook(() => useCountdown(2))
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current).toBe(0)
  })

  it('a zero start stays at zero', () => {
    const { result } = renderHook(() => useCountdown(0))
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(0)
  })

  it('cleans up its interval on unmount', () => {
    const { unmount } = renderHook(() => useCountdown(5))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
```

## Solution

```typescript
import { useEffect, useState } from 'react'

/**
 * Counts down from `start` once per second, stopping at zero.
 */
export function useCountdown(start: number): number {
  const [seconds, setSeconds] = useState(start)

  useEffect(() => {
    const id = setInterval(() => {
      // The original read `seconds` here — the value from the render the
      // effect ran in, captured once and never updated, so every tick set
      // start - 1 again. The functional form asks React for the CURRENT
      // value at each tick, which makes the closure's age irrelevant — and
      // keeps the effect honestly dependency-free, so the interval is
      // created once instead of being torn down and rebuilt every second.
      setSeconds((current) => (current > 0 ? current - 1 : current))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return seconds
}
```
