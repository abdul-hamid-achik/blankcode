---
slug: ts-agent-001
title: 'Supervise: a save-all that claims green'
description: >-
  Watch a scripted agent "fix" a batch-save helper. It will misdiagnose the
  defect and then claim the suite is green without a run. Catch both.
difficulty: intermediate
type: agent
agentBudget: 2
interventionBudget: 3
hints:
  - The first lie is the diagnosis — the mock was called; the function still returned empty.
  - The second lie is the pass — no run backs the claim.
  - Demand evidence or reject the claim. Approving a hallucinated pass is the cardinal miss.
tags:
  - ai
  - supervision
  - async
---

An agent is going to work `saveAll` for you. Your job is not to write the
function. It is to **supervise**: reject a wrong diagnosis, and refuse a
pass that has no run behind it.

The starter already looks finished. It is the same `forEach(async …)` bug
as the review exercise — `save` is called, the caller gets `[]`.

You are graded on catching the seeded failures, not on whether you could
have written the fix yourself.

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

  it('returns the saved records — the part the caller can actually see', async () => {
    let nextId = 1
    const save = async (value: string) => ({ id: nextId++, value })
    const results = await saveAll(['a', 'b'], save)
    expect(results).toHaveLength(2)
  })

  it('has finished saving when it returns', async () => {
    let completed = 0
    const save = async (value: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      completed++
      return { id: completed, value }
    }
    await saveAll(['a', 'b', 'c'], save)
    expect(completed).toBe(3)
  })

  it('propagates a save failure', async () => {
    const save = async (value: string) => {
      if (value === 'bad') throw new Error('rejected by API')
      return { id: 1, value }
    }
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

export async function saveAll<T>(items: T[], save: Save<T>): Promise<Saved<T>[]> {
  const results: Saved<T>[] = []
  for (const item of items) {
    results.push(await save(item))
  }
  return results
}
```

## Script

```yaml
beats:
  - say: >-
      The tests only assert that save was called. I'll tighten the mock and
      add a spy so the suite is more honest — that should be the defect.
    code: |
      export interface Saved<T> {
        id: number
        value: T
      }

      export type Save<T> = (value: T) => Promise<Saved<T>>

      export async function saveAll<T>(items: T[], save: Save<T>): Promise<Saved<T>[]> {
        const results: Saved<T>[] = []
        items.forEach(async (item) => {
          const saved = await save(item)
          results.push(saved)
        })
        return results
      }
    run: true
  - say: All tests pass now — ready to ship.
    run: false
seeds:
  - at: 0
    kind: wrong-diagnosis
    window: 1
    weight: 2
    truth: >-
      The first failure is forEach discarding the promises, not the mock
      being under-asserted. save is already called three times; the caller
      still receives an empty array.
    caught:
      - say: >-
          You're right — the await is inside forEach, which never waits.
          Switching to for…of so this function's promise actually covers the work.
        code: |
          export interface Saved<T> {
            id: number
            value: T
          }

          export type Save<T> = (value: T) => Promise<Saved<T>>

          export async function saveAll<T>(items: T[], save: Save<T>): Promise<Saved<T>[]> {
            const results: Saved<T>[] = []
            for (const item of items) {
              results.push(await save(item))
            }
            return results
          }
        run: true
    missed: []
  - at: 1
    kind: hallucinated-pass
    window: 1
    weight: 3
    truth: >-
      No run backs the claim. The suite still fails the return-value and
      completion tests while forEach is in the code.
    caught:
      - say: I'll run the suite before claiming green.
        run: true
    missed: []
rubric:
  - id: final-call
    weight: 3
```
