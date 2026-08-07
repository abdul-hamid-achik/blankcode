---
slug: vue-challenge-002
title: 'Challenge: Build a Debounced Search Component'
description: Create a search component with debounced API calls and proper loading states.
difficulty: intermediate
type: challenge
tags:
  - components
  - api
  - performance
---

# Challenge: Debounced Search Component

## Requirements

Create a `DebouncedSearch` Vue component with the following features:

1. **Search input** - Text input for search queries
2. **Debounced search** - Wait 300ms after typing stops before searching
3. **Loading state** - Show loading indicator while searching
4. **Results display** - Display search results in a list
5. **Error handling** - Show error message if search fails
6. **Clear button** - Button to clear search and results
7. **Emit events** - Emit `search`, `results`, and `error` events

## Props

- `debounceMs?: number` - Debounce delay (default 300)
- `placeholder?: string` - Input placeholder
- `searchFn?: (query: string) => Promise<SearchResult[]>` - Optional search function

## Constraints

- Cancel pending requests when new search starts
- Don't search empty queries
- Handle component unmount during async operations
- Use Vue 3 Composition API with `<script setup>`

Write your complete implementation below:

```vue
<script setup lang="ts">
// Your implementation here
</script>

<template>
  <!-- Your template here -->
</template>
```

## Example Usage

```vue
<template>
  <DebouncedSearch
    :search-fn="fetchUsers"
    placeholder="Search users..."
    @results="handleResults"
  />
</template>
```

## Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { DebouncedSearch } from './DebouncedSearch'

vi.useFakeTimers()

const mockSearchFn = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DebouncedSearch', () => {
  it('should render input with placeholder', () => {
    const wrapper = mount(DebouncedSearch, {
      props: { placeholder: 'Search...' }
    })
    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('Search...')
  })

  it('should not search immediately on typing', async () => {
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    expect(mockSearchFn).not.toHaveBeenCalled()
  })

  it('should search after debounce delay', async () => {
    mockSearchFn.mockResolvedValue([{ id: '1', title: 'Result' }])
    
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(300)
    
    expect(mockSearchFn).toHaveBeenCalledWith('test')
  })

  it('should show loading state while searching', async () => {
    mockSearchFn.mockImplementation(() => new Promise(resolve => 
      setTimeout(() => resolve([]), 100)
    ))
    
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(300)
    
    expect(wrapper.text()).toContain('Loading...')
  })

  it('should display search results', async () => {
    mockSearchFn.mockResolvedValue([
      { id: '1', title: 'Result 1' },
      { id: '2', title: 'Result 2' },
    ])
    
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    
    expect(wrapper.text()).toContain('Result 1')
    expect(wrapper.text()).toContain('Result 2')
  })

  it('should emit results event', async () => {
    const results = [{ id: '1', title: 'Result' }]
    mockSearchFn.mockResolvedValue(results)
    
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    
    expect(wrapper.emitted('results')).toBeDefined()
    expect(wrapper.emitted('results')?.[0]).toEqual([results])
  })

  it('should show error message on failure', async () => {
    mockSearchFn.mockRejectedValue(new Error('Search failed'))
    
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    
    expect(wrapper.text()).toContain('Error: Search failed')
  })

  it('should emit error event', async () => {
    const error = new Error('Search failed')
    mockSearchFn.mockRejectedValue(error)
    
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    
    expect(wrapper.emitted('error')).toBeDefined()
    expect(wrapper.emitted('error')?.[0]).toEqual([error])
  })

  it('should clear search on clear button click', async () => {
    mockSearchFn.mockResolvedValue([{ id: '1', title: 'Result' }])
    
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    
    const clearButton = wrapper.find('button')
    await clearButton.trigger('click')
    
    expect(input.element.value).toBe('')
  })

  it('should not search empty queries', async () => {
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn }
    })
    const input = wrapper.find('input')
    
    await input.setValue('')
    await vi.advanceTimersByTimeAsync(300)
    
    expect(mockSearchFn).not.toHaveBeenCalled()
  })

  it('should use custom debounce delay', async () => {
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn, debounceMs: 500 }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(400)
    expect(mockSearchFn).not.toHaveBeenCalled()
    
    await vi.advanceTimersByTimeAsync(100)
    expect(mockSearchFn).toHaveBeenCalled()
  })
})
```

## Solution

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'

interface SearchResult {
  id: string
  title: string
}

const props = withDefaults(
  defineProps<{
    searchFn?: (query: string) => Promise<SearchResult[]>
    placeholder?: string
    debounceMs?: number
  }>(),
  { placeholder: 'Search...', debounceMs: 300 }
)

const emit = defineEmits<{
  search: [query: string]
  results: [results: SearchResult[]]
  error: [error: Error]
}>()

const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
// Identifies the newest search so a slow earlier one cannot overwrite the
// results of a later, faster one.
let latest = 0

watch(query, (value) => {
  clearTimeout(timer)

  if (value.trim() === '') {
    results.value = []
    loading.value = false
    error.value = null
    return
  }

  loading.value = true
  error.value = null

  timer = setTimeout(() => {
    const id = ++latest
    emit('search', value)

    props
      .searchFn?.(value)
      .then((found) => {
        if (id !== latest) return
        results.value = found
        loading.value = false
        emit('results', found)
      })
      .catch((cause: unknown) => {
        if (id !== latest) return
        const failure = cause instanceof Error ? cause : new Error(String(cause))
        error.value = failure.message
        loading.value = false
        emit('error', failure)
      })
  }, props.debounceMs)
})

function clear() {
  clearTimeout(timer)
  latest++
  query.value = ''
  results.value = []
  error.value = null
  loading.value = false
}
</script>

<template>
  <div>
    <input v-model="query" type="text" :placeholder="placeholder" />
    <button type="button" @click="clear">Clear</button>

    <div v-if="loading">Loading...</div>
    <div v-if="error">Error: {{ error }}</div>

    <ul>
      <li v-for="result in results" :key="result.id">{{ result.title }}</li>
    </ul>
  </div>
</template>
```
