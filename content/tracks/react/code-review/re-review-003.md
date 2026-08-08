---
slug: re-review-003
title: 'Review: a fetch that loses the race to itself'
description: The user-loading hook below passes its tests. Click between two profiles quickly and the first one wins the screen. Find why the slower response gets the last word.
difficulty: advanced
type: review
hints:
  - The shipped test changes the id once and lets each response arrive in order. Networks do not promise order.
  - When the id changes, the old effect's request is still in flight. What happens when it lands?
  - The cleanup function is not just for unsubscribing. It is where an effect learns its results are no longer wanted.
tags:
  - code-review
  - hooks
  - race-conditions
---

You asked a model for a hook that loads a user's name by id. It produced
this, with a test. The test passes.

Switch ids while a request is in flight and the screen can end up showing
the *previous* user: each effect run fires a request, and whichever response
lands last writes state last — the component has no idea that answer was for
a question it stopped asking. The shipped test resolves responses in
request order, which is the one schedule real networks refuse to guarantee.

Nothing here needs a lock. It needs the effect to notice its own
obsolescence, which is exactly what the cleanup function exists to signal.

Find the defect and fix it. You are graded on tests you cannot see.

```typescript
import { useEffect, useState } from 'react'

export type FetchName = (id: number) => Promise<string>

/**
 * Loads the display name for a user id, reloading when the id changes.
 */
export function useUserName(id: number, fetchName: FetchName): string | null {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    fetchName(id).then((loaded) => {
      setName(loaded)
    })
  }, [id, fetchName])

  return name
}
```

## The tests it came with

This passes. The response arrives before the id changes — the polite
schedule.

```typescript
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('useUserName', () => {
  it('loads the name for an id', async () => {
    const fetchName = async (id: number) => `user-${id}`
    const { result } = renderHook(() => useUserName(1, fetchName))
    await act(async () => {})
    expect(result.current).toBe('user-1')
  })
})
```

## Tests

```typescript
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useUserName, type FetchName } from './solution'

/** A fetch whose responses resolve only when the test says so. */
function controlledFetch() {
  const pending = new Map<number, (name: string) => void>()
  const fetchName: FetchName = (id) =>
    new Promise((resolve) => {
      pending.set(id, resolve)
    })
  return {
    fetchName,
    resolve(id: number) {
      pending.get(id)?.(`user-${id}`)
      pending.delete(id)
    },
  }
}

describe('useUserName', () => {
  it('loads the name for an id', async () => {
    const fetchName = async (id: number) => `user-${id}`
    const { result } = renderHook(() => useUserName(1, fetchName))
    await act(async () => {})
    expect(result.current).toBe('user-1')
  })

  it('reloads when the id changes', async () => {
    const fetchName = async (id: number) => `user-${id}`
    const { result, rerender } = renderHook(({ id }) => useUserName(id, fetchName), {
      initialProps: { id: 1 },
    })
    await act(async () => {})
    rerender({ id: 2 })
    await act(async () => {})
    expect(result.current).toBe('user-2')
  })

  it('ignores a stale response that lands after the id changed', async () => {
    // The race, made deterministic: request 1 fires, the id moves on to 2,
    // request 2 resolves FIRST, then request 1 finally lands. The screen
    // must keep user-2 — the answer to the question currently being asked.
    const controlled = controlledFetch()
    const { result, rerender } = renderHook(
      ({ id }) => useUserName(id, controlled.fetchName),
      { initialProps: { id: 1 } }
    )

    rerender({ id: 2 })
    await act(async () => {
      controlled.resolve(2)
    })
    expect(result.current).toBe('user-2')

    await act(async () => {
      controlled.resolve(1)
    })
    expect(result.current).toBe('user-2')
  })
})
```

## Solution

```typescript
import { useEffect, useState } from 'react'

export type FetchName = (id: number) => Promise<string>

/**
 * Loads the display name for a user id, reloading when the id changes.
 */
export function useUserName(id: number, fetchName: FetchName): string | null {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    /*
     * The original applied every response that ever arrived, so the slowest
     * request got the last word regardless of which id the component was
     * showing by then. React runs this cleanup the moment the effect's deps
     * change — which is precisely "this run's answer is no longer wanted".
     * The flag costs one boolean and closes the race without any ordering
     * assumptions about the network.
     */
    let current = true

    fetchName(id).then((loaded) => {
      if (current) {
        setName(loaded)
      }
    })

    return () => {
      current = false
    }
  }, [id, fetchName])

  return name
}
```
