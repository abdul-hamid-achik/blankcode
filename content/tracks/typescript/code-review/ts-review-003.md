---
slug: ts-review-003
title: 'Review: a save-all that returns before saving'
description: The batch-save helper below passes its tests — every item gets saved. It also returns an empty array to every caller. Find the async seam.
difficulty: advanced
type: review
hints:
  - The shipped tests assert that save was CALLED. The function's job was to return what save RESOLVED. Those happen at different times.
  - What does forEach do with the promise your async callback returns?
  - The fix is not sprinkling await inside the loop body you have. It is choosing a loop the language can await.
tags:
  - code-review
  - async
  - promises
---

You asked a model to save a batch of items and return the saved records. It
produced this, with tests. The tests pass — `save` really is called once per
item.

Every caller receives an empty array. `forEach` invokes the async callback
and throws the returned promise away; the `await` inside only sequences work
*within* each callback, not the callbacks within the function. `saveAll`
returns at the first opportunity, `results` fills in afterwards, unobserved.
The shipped suite asserts that `save` was called — true immediately — and
never awaits the function's own return value for content, which is the only
thing a caller can see.

This is the most common async bug in generated TypeScript, and it survives
review because the code *contains* an await. It is just aimed at nothing.

Find the defect and fix it. You are graded on tests you cannot see.

```typescript
export interface Saved<T> {
  id: number
  value: T
}

export type Save<T> = (value: T) => Promise<Saved<T>>

/**
 * Saves every item in order and returns the saved records.
 */
export async function saveAll<T>(items: T[], save: Save<T>): Promise<Saved<T>[]> {
  const results: Saved<T>[] = []

  items.forEach(async (item) => {
    const saved = await save(item)
    results.push(saved)
  })

  return results
}
```

## The tests it came with

These all pass. Both assert on the mock; neither looks at what the function
handed back.

```typescript
import { describe, expect, it, vi } from 'vitest'

describe('saveAll', () => {
  it('saves every item', async () => {
    let nextId = 1
    const save = vi.fn(async (value: string) => ({ id: nextId++, value }))
    await saveAll(['a', 'b', 'c'], save)
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('saves items with their values', async () => {
    const save = vi.fn(async (value: string) => ({ id: 1, value }))
    await saveAll(['x'], save)
    expect(save).toHaveBeenCalledWith('x')
  })
})
```

## Tests

```typescript
import { describe, expect, it, vi } from 'vitest'
import { saveAll } from './solution'

describe('saveAll', () => {
  it('saves every item', async () => {
    let nextId = 1
    const save = vi.fn(async (value: string) => ({ id: nextId++, value }))
    await saveAll(['a', 'b', 'c'], save)
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('saves items with their values', async () => {
    const save = vi.fn(async (value: string) => ({ id: 1, value }))
    await saveAll(['x'], save)
    expect(save).toHaveBeenCalledWith('x')
  })

  it('returns the saved records — the part the caller can actually see', async () => {
    let nextId = 1
    const save = async (value: string) => ({ id: nextId++, value })
    const results = await saveAll(['a', 'b'], save)
    expect(results).toHaveLength(2)
  })

  it('returns records in input order', async () => {
    let nextId = 1
    const save = async (value: string) => ({ id: nextId++, value })
    const results = await saveAll(['a', 'b', 'c'], save)
    expect(results.map((r) => r.value)).toEqual(['a', 'b', 'c'])
  })

  it('has finished saving when it returns', async () => {
    // The defect in one assertion: work started inside the function must not
    // still be in flight after its promise settles.
    let completed = 0
    const save = async (value: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      completed++
      return { id: completed, value }
    }
    await saveAll(['a', 'b', 'c'], save)
    expect(completed).toBe(3)
  })

  it('saves sequentially, not all at once', async () => {
    // "In order" means one completes before the next begins — the property
    // that matters when save hits a rate-limited API.
    let inFlight = 0
    let maxInFlight = 0
    const save = async (value: string) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight--
      return { id: 1, value }
    }
    await saveAll(['a', 'b', 'c'], save)
    expect(maxInFlight).toBe(1)
  })

  it('propagates a save failure', async () => {
    const save = async (value: string) => {
      if (value === 'bad') throw new Error('rejected by API')
      return { id: 1, value }
    }
    // With forEach the rejection happens after return, unhandled — the
    // caller's try/catch around saveAll catches nothing.
    await expect(saveAll(['ok', 'bad'], save)).rejects.toThrow('rejected by API')
  })
})
```

## Solution

```typescript
export interface Saved<T> {
  id: number
  value: T
}

export type Save<T> = (value: T) => Promise<Saved<T>>

/**
 * Saves every item in order and returns the saved records.
 */
export async function saveAll<T>(items: T[], save: Save<T>): Promise<Saved<T>[]> {
  /*
   * The original used items.forEach(async …). forEach discards the promise
   * each callback returns, so nothing connected those awaits to this
   * function: it returned an empty array immediately, the pushes landed
   * later where no one was looking, and a failing save became an unhandled
   * rejection instead of an error the caller could catch.
   *
   * for…of keeps the awaits on THIS function's timeline: each save
   * completes before the next begins, the array is full before return, and
   * a rejection propagates through the ordinary channel.
   */
  const results: Saved<T>[] = []

  for (const item of items) {
    results.push(await save(item))
  }

  return results
}
```
