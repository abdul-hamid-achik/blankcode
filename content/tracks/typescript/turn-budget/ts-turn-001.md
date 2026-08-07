---
slug: ts-turn-001
title: 'Three messages: a retry that has to give up'
description: Get a model to write a retry helper in three messages. The suite you are graded against is hidden until you submit, and it checks the two things people forget to ask for.
difficulty: intermediate
type: turn
turnBudget: 3
hints:
  - Spend the first message on the whole shape, including what should happen when it never succeeds. Vague in, coherent out — and coherent is what makes a wrong answer hard to notice.
  - Before your second message, read what came back and find what you did not specify. That is where the defect will be.
  - You do not have to spend all three. Submitting with a turn in hand is a better result, and the report says so.
tags:
  - ai
  - prompting
  - error-handling
---

Write `retry`, using a model, in **three messages**.

> `retry(operation, attempts, delayMs)` calls `operation()`. If it throws, it
> waits `delayMs` and tries again, up to `attempts` times total. It returns the
> first successful result. If every attempt fails it throws the last error.
> `attempts` of zero or less throws immediately without calling anything.

That is the whole specification, and it is deliberately the sort of thing you
would type quickly. Two of its clauses are the ones people leave out of the
first message, and a model will pick a reading for each without telling you
which one it chose.

**The suite you are graded against is hidden until you submit.** You cannot
paste it to the model, which is the point: if you could, the skill being
practised would be pasting.

You have three messages and you do not have to use them. Submitting with a turn
in hand is a better result than using all three, and the report tells you which
happened.

```typescript
/**
 * Calls `operation`, retrying on failure.
 *
 * Write this with the model. When you are satisfied, submit — the hidden suite
 * runs against whatever is in here.
 */
export async function retry<T>(
  operation: () => Promise<T>,
  attempts: number,
  delayMs: number
): Promise<T> {
  throw new Error('not implemented')
}
```

## Tests

```typescript
import { describe, expect, it, vi } from 'vitest'
import { retry } from './solution'

describe('retry', () => {
  it('returns the result when the first attempt works', async () => {
    await expect(retry(async () => 'ok', 3, 0)).resolves.toBe('ok')
  })

  it('retries until one succeeds', async () => {
    let calls = 0
    const operation = async () => {
      calls++
      if (calls < 3) throw new Error('not yet')
      return 'ok'
    }

    await expect(retry(operation, 5, 0)).resolves.toBe('ok')
    expect(calls).toBe(3)
  })

  it('stops at the attempt limit', async () => {
    let calls = 0
    const operation = async () => {
      calls++
      throw new Error('always')
    }

    await expect(retry(operation, 3, 0)).rejects.toThrow('always')
    // Three attempts, not three retries after the first. "Up to `attempts`
    // times total" is the clause that gets read the other way.
    expect(calls).toBe(3)
  })

  it('throws the last error, not the first', async () => {
    let calls = 0
    const operation = async () => {
      calls++
      throw new Error(`failure ${calls}`)
    }

    // The one people forget to ask for. A helper that reports the first error
    // sends you to debug a transient failure instead of the real one.
    await expect(retry(operation, 3, 0)).rejects.toThrow('failure 3')
  })

  it('throws without calling anything when attempts is zero', async () => {
    const operation = vi.fn(async () => 'ok')
    await expect(retry(operation, 0, 0)).rejects.toThrow()
    // The other forgotten clause. Calling once "because zero must be a mistake"
    // is the plausible reading a model will take unsupervised.
    expect(operation).not.toHaveBeenCalled()
  })

  it('throws without calling anything when attempts is negative', async () => {
    const operation = vi.fn(async () => 'ok')
    await expect(retry(operation, -1, 0)).rejects.toThrow()
    expect(operation).not.toHaveBeenCalled()
  })

  it('waits between attempts', async () => {
    const started = Date.now()
    let calls = 0
    const operation = async () => {
      calls++
      if (calls < 3) throw new Error('not yet')
      return 'ok'
    }

    await retry(operation, 3, 20)
    // Two gaps for three attempts, not three: there is nothing to wait for
    // after the last one.
    expect(Date.now() - started).toBeGreaterThanOrEqual(35)
  })

  it('does not wait after the final failure', async () => {
    const started = Date.now()
    const operation = async () => {
      throw new Error('always')
    }

    await expect(retry(operation, 2, 40)).rejects.toThrow()
    expect(Date.now() - started).toBeLessThan(120)
  })

  it('passes the resolved value through unchanged', async () => {
    const value = { nested: { count: 1 } }
    await expect(retry(async () => value, 1, 0)).resolves.toBe(value)
  })

  it('works with a single attempt', async () => {
    const operation = vi.fn(async () => {
      throw new Error('once')
    })

    await expect(retry(operation, 1, 0)).rejects.toThrow('once')
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
```

## Solution

```typescript
export async function retry<T>(
  operation: () => Promise<T>,
  attempts: number,
  delayMs: number
): Promise<T> {
  /*
   * The two clauses that decide this exercise are the two a quick request
   * leaves out, and a model resolves both silently:
   *
   * - "up to `attempts` times total" is the attempt count, not the number of
   *   retries after the first. Read the other way it runs one time too many,
   *   which is invisible until something rate-limits you.
   * - zero or fewer throws *without calling*. Calling once anyway is the
   *   plausible reading — zero looks like a mistake — and it means a caller
   *   that computed `attempts` from configuration gets one unwanted request.
   */
  if (attempts < 1) {
    throw new Error(`retry needs at least one attempt, got ${attempts}`)
  }

  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      // Kept rather than rethrown immediately: the caller needs the failure
      // that ended it, not the transient one that started it.
      lastError = error
      // No wait after the final attempt — there is nothing left to wait for,
      // and sleeping there adds a delay to every failure path for nothing.
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError
}
```
