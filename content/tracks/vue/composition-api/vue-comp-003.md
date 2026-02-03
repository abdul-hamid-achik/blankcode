---
slug: vue-comp-003
title: Watchers
description: Use watch and watchEffect to react to state changes.
difficulty: intermediate
hints:
  - watch() observes specific reactive sources
  - watchEffect() automatically tracks dependencies
  - Both can be used for side effects
tags:
  - vue
  - watch
  - reactivity
---

Implement watchers to sync data and trigger side effects.

```typescript
import { ref, ___blank_start___watch___blank_end___, watchEffect } from 'vue'

export function useSearch() {
  const query = ref('')
  const results = ref<string[]>([])
  const isLoading = ref(false)
  const searchHistory = ref<string[]>([])

  // Watch query changes and update history
  ___blank_start___watch(query___blank_end___, (newQuery, oldQuery) => {
    if (newQuery && newQuery !== oldQuery) {
      searchHistory.value.___blank_start___push(newQuery)___blank_end___
    }
  })

  // Simulated search function
  async function performSearch(q: string): Promise<string[]> {
    await new Promise(r => setTimeout(r, 100))
    return [`Result 1 for ${q}`, `Result 2 for ${q}`]
  }

  // Watch with async handler
  watch(query, async (newQuery) => {
    if (!newQuery) {
      results.value = []
      return
    }
    ___blank_start___isLoading.value = true___blank_end___
    results.value = await performSearch(newQuery)
    isLoading.value = false
  })

  return { query, results, isLoading, searchHistory }
}
```

## Tests

```typescript
import { expect, test, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSearch } from './use-search'

test('starts with empty state', () => {
  const { query, results, isLoading } = useSearch()
  expect(query.value).toBe('')
  expect(results.value).toEqual([])
  expect(isLoading.value).toBe(false)
})

test('tracks search history', async () => {
  const { query, searchHistory } = useSearch()
  query.value = 'vue'
  await nextTick()
  query.value = 'react'
  await nextTick()
  expect(searchHistory.value).toContain('vue')
  expect(searchHistory.value).toContain('react')
})

test('sets loading state during search', async () => {
  const { query, isLoading } = useSearch()
  query.value = 'test'
  await nextTick()
  expect(isLoading.value).toBe(true)
})
```
