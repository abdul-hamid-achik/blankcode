---
slug: ts-review-001
title: 'Review: a paginated fetch that drops a page'
description: The pagination helper below was generated, reviewed by its own tests, and shipped. It loses records. Find out which ones and why.
difficulty: intermediate
type: review
hints:
  - The tests it came with only ever use a total that divides evenly by the page size.
  - Work out by hand what happens when there are 25 records and the page size is 10.
  - Off-by-one errors hide in the comparison, not in the arithmetic.
tags:
  - code-review
  - pagination
  - off-by-one
---

You asked a model for a helper that fetches every page of a paginated API and
returns the records. It produced this, along with tests. The tests pass.

It is still wrong: under some inputs it silently returns fewer records than the
API has. Nothing throws, nothing logs, and the shape of the result is correct —
which is exactly why this class of bug reaches production.

Find the defect and fix it. You are graded on tests you cannot see.

```typescript
export interface Page<T> {
  items: T[]
  total: number
}

export type FetchPage<T> = (offset: number, limit: number) => Promise<Page<T>>

/**
 * Fetches every page and returns all records in order.
 */
export async function fetchAll<T>(fetchPage: FetchPage<T>, pageSize = 10): Promise<T[]> {
  const first = await fetchPage(0, pageSize)
  const all = [...first.items]

  const pageCount = Math.floor(first.total / pageSize)

  for (let page = 1; page < pageCount; page++) {
    const next = await fetchPage(page * pageSize, pageSize)
    all.push(...next.items)
  }

  return all
}
```

## The tests it came with

These all pass. They are here so you can see what a passing suite proves, and
what it does not.

```typescript
import { describe, expect, it } from 'vitest'

function api(total: number) {
  const records = Array.from({ length: total }, (_, i) => i)
  return (offset: number, limit: number) =>
    Promise.resolve({ items: records.slice(offset, offset + limit), total })
}

describe('fetchAll', () => {
  it('fetches a single full page', async () => {
    expect(await fetchAll(api(10))).toHaveLength(10)
  })

  it('fetches several full pages', async () => {
    expect(await fetchAll(api(30))).toHaveLength(30)
  })

  it('returns records in order', async () => {
    expect(await fetchAll(api(20))).toEqual(Array.from({ length: 20 }, (_, i) => i))
  })
})
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { fetchAll } from './solution'

function api(total: number) {
  const records = Array.from({ length: total }, (_, i) => i)
  return (offset: number, limit: number) =>
    Promise.resolve({ items: records.slice(offset, offset + limit), total })
}

describe('fetchAll', () => {
  it('fetches a single full page', async () => {
    expect(await fetchAll(api(10))).toHaveLength(10)
  })

  it('fetches several full pages', async () => {
    expect(await fetchAll(api(30))).toHaveLength(30)
  })

  it('returns records in order', async () => {
    expect(await fetchAll(api(20))).toEqual(Array.from({ length: 20 }, (_, i) => i))
  })

  it('does not drop the final partial page', async () => {
    // 25 records at 10 per page is two full pages and a remainder of five.
    expect(await fetchAll(api(25))).toHaveLength(25)
  })

  it('handles a total smaller than one page', async () => {
    expect(await fetchAll(api(3))).toHaveLength(3)
  })

  it('handles an empty result', async () => {
    expect(await fetchAll(api(0))).toEqual([])
  })

  it('respects a custom page size', async () => {
    expect(await fetchAll(api(7), 3)).toHaveLength(7)
  })

  it('asks for each page exactly once', async () => {
    const offsets: number[] = []
    const records = Array.from({ length: 25 }, (_, i) => i)
    await fetchAll((offset, limit) => {
      offsets.push(offset)
      return Promise.resolve({ items: records.slice(offset, offset + limit), total: 25 })
    })

    expect(offsets).toEqual([0, 10, 20])
  })
})
```

## Solution

```typescript
export interface Page<T> {
  items: T[]
  total: number
}

export type FetchPage<T> = (offset: number, limit: number) => Promise<Page<T>>

export async function fetchAll<T>(fetchPage: FetchPage<T>, pageSize = 10): Promise<T[]> {
  const first = await fetchPage(0, pageSize)
  const all = [...first.items]

  // `Math.floor` counted only the *whole* pages, so a remainder was never
  // fetched: 25 records at 10 per page gave 2, and the last five vanished.
  // Every test it came with used a total that divided evenly, so the bug was
  // invisible to its own suite.
  const pageCount = Math.ceil(first.total / pageSize)

  for (let page = 1; page < pageCount; page++) {
    const next = await fetchPage(page * pageSize, pageSize)
    all.push(...next.items)
  }

  return all
}
```
