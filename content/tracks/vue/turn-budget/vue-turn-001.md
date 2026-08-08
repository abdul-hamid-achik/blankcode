---
slug: vue-turn-001
title: 'Three messages: a pagination that survives its data shrinking'
description: Get a model to write usePagination in three messages. The hidden suite deletes items while you are on the last page — the case that decides whether this is a formula or a bug.
difficulty: intermediate
type: turn
turnBudget: 3
hints:
  - Decide what page an empty list shows. Zero pages is a plausible model answer and a broken UI.
  - next() on the last page and prev() on the first have to do something. Say what, or two implementations will disagree.
  - The data is a ref and it shrinks. Ask what happens to page 5 of 3 before the hidden suite asks for you.
tags:
  - ai
  - prompting
  - reactivity
---

Write `usePagination`, using a model, in **three messages**.

> `usePagination(totalItems, pageSize)` — `totalItems` is a `Ref<number>`.
> Returns `{ page, totalPages, next, prev }`. Pages are 1-based.
> `totalPages` is at least 1, even for zero items. `next()` and `prev()`
> clamp at the ends. When `totalItems` shrinks below the current page, the
> page moves to the new last page — by itself, reactively.

That is the whole specification. Its last sentence is the exercise: the
clauses before it are settled by any competent implementation, but "the data
shrank while you were standing on page 5" is a case a model will not handle
unless told — and half the time it handles it by clamping inside `next()`,
which fixes the page only when the user happens to press a button.

Deletions happen. A pagination that can display "page 5 of 3" is not a
pagination; it is two numbers near each other.

**The suite you are graded against is hidden until you submit.** You cannot
paste it to the model; if you could, the skill being practised would be
pasting.

You have three messages and you do not have to use them. Submitting with a
turn in hand is a better result, and the report says which happened.

```typescript
import { ref, type Ref } from 'vue'

export interface Pagination {
  page: Ref<number>
  totalPages: Ref<number>
  next: () => void
  prev: () => void
}

/**
 * 1-based pagination over a reactive item count.
 *
 * Write this with the model. When you are satisfied, submit — the hidden
 * suite runs against whatever is in here.
 */
export function usePagination(totalItems: Ref<number>, pageSize: number): Pagination {
  return { page: ref(1), totalPages: ref(1), next: () => {}, prev: () => {} }
}
```

## Tests

```typescript
import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { usePagination } from './solution'

describe('usePagination', () => {
  it('starts on page 1', () => {
    const pagination = usePagination(ref(50), 10)
    expect(pagination.page.value).toBe(1)
    expect(pagination.totalPages.value).toBe(5)
  })

  it('rounds partial pages up', () => {
    const pagination = usePagination(ref(41), 10)
    expect(pagination.totalPages.value).toBe(5)
  })

  it('an empty list still has one page', () => {
    // Zero pages is the plausible wrong answer: a UI showing "page 1 of 0"
    // or hiding its controls entirely.
    const pagination = usePagination(ref(0), 10)
    expect(pagination.totalPages.value).toBe(1)
  })

  it('next advances and clamps at the last page', () => {
    const pagination = usePagination(ref(25), 10)
    pagination.next()
    pagination.next()
    expect(pagination.page.value).toBe(3)
    pagination.next()
    expect(pagination.page.value).toBe(3)
  })

  it('prev goes back and clamps at page 1', () => {
    const pagination = usePagination(ref(25), 10)
    pagination.next()
    pagination.prev()
    expect(pagination.page.value).toBe(1)
    pagination.prev()
    expect(pagination.page.value).toBe(1)
  })

  it('totalPages follows the ref', async () => {
    const totalItems = ref(10)
    const pagination = usePagination(totalItems, 10)
    totalItems.value = 35
    await nextTick()
    expect(pagination.totalPages.value).toBe(4)
  })

  it('shrinking data pulls the page back — reactively, not on next click', async () => {
    // The deciding clause: standing on page 5 when the data drops to 3
    // pages. The fix has to live in the reactive graph, not inside next() —
    // a clamp that waits for a button press leaves "page 5 of 3" on screen.
    const totalItems = ref(50)
    const pagination = usePagination(totalItems, 10)
    pagination.next()
    pagination.next()
    pagination.next()
    pagination.next()
    expect(pagination.page.value).toBe(5)

    totalItems.value = 23
    await nextTick()
    expect(pagination.totalPages.value).toBe(3)
    expect(pagination.page.value).toBe(3)
  })

  it('growing data leaves the current page alone', async () => {
    const totalItems = ref(30)
    const pagination = usePagination(totalItems, 10)
    pagination.next()
    totalItems.value = 100
    await nextTick()
    expect(pagination.page.value).toBe(2)
  })
})
```

## Solution

```typescript
import { computed, ref, watch, type Ref } from 'vue'

export interface Pagination {
  page: Ref<number>
  totalPages: Ref<number>
  next: () => void
  prev: () => void
}

/**
 * 1-based pagination over a reactive item count.
 */
export function usePagination(totalItems: Ref<number>, pageSize: number): Pagination {
  const page = ref(1)

  // A formula, not a snapshot: totalPages re-derives when the ref moves.
  // Math.max(1, …) is the empty-list clause — zero items is one empty page,
  // never zero pages.
  const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize)))

  /*
   * The deciding clause lives here. Clamping inside next()/prev() fixes the
   * page only when the user presses a button; a watcher fixes it the moment
   * the data shrinks, which is what "by itself, reactively" means. Growth
   * needs nothing — a valid page stays valid when pages are added.
   */
  watch(totalPages, (pages) => {
    if (page.value > pages) {
      page.value = pages
    }
  })

  function next(): void {
    page.value = Math.min(page.value + 1, totalPages.value)
  }

  function prev(): void {
    page.value = Math.max(page.value - 1, 1)
  }

  return { page, totalPages, next, prev }
}
```
