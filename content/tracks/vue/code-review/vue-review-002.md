---
slug: vue-review-002
title: 'Review: a watcher that watched a string once'
description: The search composable below passes its tests. Type into it and nothing ever fires. The bug is in what got handed to watch — find it.
difficulty: intermediate
type: review
hints:
  - What does state.query evaluate to at the moment watch is called? Not later — at that moment.
  - Vue even prints a warning about this shape of watch source. The generated tests never looked at warnings.
  - watch needs something it can call again, or a ref it can track. One character of syntax decides which you handed it.
tags:
  - code-review
  - reactivity
  - watchers
---

You asked a model for a search composable: hold a query string, and each time
it changes, call the provided `onSearch` with the new value — skipping blank
queries. It produced this, with tests. The tests pass.

`onSearch` never fires. Not once. `watch(state.query, …)` evaluates
`state.query` immediately — producing a plain string, `""` — and hands that
string to `watch`. A string carries no subscription; there is nothing for Vue
to track. Vue logs a warning about exactly this, but a warning is not a
failure, and the shipped tests only assert on state they set themselves, so
green stays green.

The one-character spelling difference between "a value read now" and "a
source read on every change" is the whole exercise.

Find the defect and fix it. You are graded on tests you cannot see.

```typescript
import { reactive, watch } from 'vue'

export interface SearchState {
  query: string
}

export function useSearch(onSearch: (query: string) => void) {
  const state = reactive<SearchState>({ query: '' })

  watch(state.query, (query) => {
    if (query.trim().length > 0) {
      onSearch(query)
    }
  })

  function setQuery(query: string): void {
    state.query = query
  }

  return { state, setQuery }
}
```

## The tests it came with

These all pass. Neither one asserts that `onSearch` was ever called — the
only observable the composable exists to produce.

```typescript
import { describe, expect, it, vi } from 'vitest'

describe('useSearch', () => {
  it('starts with an empty query', () => {
    const search = useSearch(vi.fn())
    expect(search.state.query).toBe('')
  })

  it('setQuery updates the state', () => {
    const search = useSearch(vi.fn())
    search.setQuery('vue')
    expect(search.state.query).toBe('vue')
  })
})
```

## Tests

```typescript
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useSearch } from './solution'

describe('useSearch', () => {
  it('starts with an empty query', () => {
    const search = useSearch(vi.fn())
    expect(search.state.query).toBe('')
  })

  it('setQuery updates the state', () => {
    const search = useSearch(vi.fn())
    search.setQuery('vue')
    expect(search.state.query).toBe('vue')
  })

  it('calls onSearch when the query changes', async () => {
    const onSearch = vi.fn()
    const search = useSearch(onSearch)
    search.setQuery('vue reactivity')
    await nextTick()
    expect(onSearch).toHaveBeenCalledWith('vue reactivity')
  })

  it('fires once per change', async () => {
    const onSearch = vi.fn()
    const search = useSearch(onSearch)
    search.setQuery('one')
    await nextTick()
    search.setQuery('two')
    await nextTick()
    expect(onSearch).toHaveBeenCalledTimes(2)
    expect(onSearch).toHaveBeenLastCalledWith('two')
  })

  it('skips blank queries', async () => {
    const onSearch = vi.fn()
    const search = useSearch(onSearch)
    search.setQuery('   ')
    await nextTick()
    expect(onSearch).not.toHaveBeenCalled()
  })
})
```

## Solution

```typescript
import { reactive, watch } from 'vue'

export interface SearchState {
  query: string
}

export function useSearch(onSearch: (query: string) => void) {
  const state = reactive<SearchState>({ query: '' })

  // The original wrote watch(state.query, …): that expression evaluates
  // RIGHT THEN, to the plain string "" — no subscription travels with a
  // primitive, so the watcher had nothing to watch and never fired. Wrapped
  // in a getter, the read happens inside a tracked scope on every check,
  // which is the difference between handing watch a value and handing it a
  // source. (state.query works from a template for the same reason: the
  // template is itself a tracked scope.)
  watch(
    () => state.query,
    (query) => {
      if (query.trim().length > 0) {
        onSearch(query)
      }
    }
  )

  function setQuery(query: string): void {
    state.query = query
  }

  return { state, setQuery }
}
```
