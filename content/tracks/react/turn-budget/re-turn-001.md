---
slug: re-turn-001
title: 'Three messages: a debounce that keeps the last word'
description: Get a model to write useDebouncedValue in three messages. The hidden suite checks the first render, the burst, and the unmount — the three moments a quick request never mentions.
difficulty: intermediate
type: turn
turnBudget: 3
hints:
  - What does the hook return on the very first render, before any delay has passed? Say it, or the model will pick undefined.
  - Five changes inside one delay window must produce exactly one update — the last. Ask what happens to the four earlier timers.
  - The unmount case is invisible in a demo and mandatory in a suite. State updates after unmount are the tell.
tags:
  - ai
  - prompting
  - hooks
---

Write `useDebouncedValue`, using a model, in **three messages**.

> `useDebouncedValue(value, delayMs)` returns a debounced copy of `value`:
> the returned value follows `value` after `delayMs` of quiet. On the first
> render it equals `value` immediately — never `undefined`. A burst of
> changes produces exactly one update: the last value wins. On unmount,
> nothing fires afterwards.

That is the whole specification, and each sentence past the first is one a
hurried request drops. A model told "debounce a value" will return
`undefined` until the first delay elapses, or let an early timer overwrite a
later value, or leave a timer running into an unmounted component — all
three read fine in a demo, because a demo types slowly and never leaves the
page.

**The suite you are graded against is hidden until you submit.** You cannot
paste it to the model; if you could, the skill being practised would be
pasting.

You have three messages and you do not have to use them. Submitting with a
turn in hand is a better result, and the report says which happened.

```typescript
import { useState } from 'react'

/**
 * The debounced copy of `value`: follows it after `delayMs` of quiet.
 *
 * Write this with the model. When you are satisfied, submit — the hidden
 * suite runs against whatever is in here.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced] = useState(value)
  return debounced
}
```

## Tests

```typescript
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './solution'

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('equals the value on the first render, immediately', () => {
    // The clause a quick request drops first: no undefined flash while the
    // first delay elapses.
    const { result } = renderHook(() => useDebouncedValue('initial', 200))
    expect(result.current).toBe('initial')
  })

  it('does not update before the delay has passed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'b' })
    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe('a')
  })

  it('updates after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'b' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('b')
  })

  it('a burst produces exactly one update, and the last value wins', () => {
    // The stale-timer bug: if earlier timers are not cancelled, "abc" typed
    // quickly settles on "a" — the first timer to fire, not the last value.
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(100))
    rerender({ value: 'abc' })
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('abc')
  })

  it('a new change restarts the quiet period', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'b' })
    act(() => vi.advanceTimersByTime(190))
    rerender({ value: 'c' })
    act(() => vi.advanceTimersByTime(190))
    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(10))
    expect(result.current).toBe('c')
  })

  it('leaves no timer running after unmount', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'b' })
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
```

## Solution

```typescript
import { useEffect, useState } from 'react'

/**
 * The debounced copy of `value`: follows it after `delayMs` of quiet.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  /*
   * The three clauses that decide this exercise:
   *
   * - useState(value) seeds the FIRST render with the real value — the
   *   "debounce" a model writes from scratch often returns undefined until
   *   the first timer fires, which flashes empty UI once per mount;
   * - the effect's cleanup cancels the previous timer on every change, so a
   *   burst collapses to its LAST value instead of its first timer;
   * - that same cleanup runs on unmount, which is the entire unmount story —
   *   no timer survives to set state on a dead component.
   */
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
```
