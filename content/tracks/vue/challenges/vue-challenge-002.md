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

Write your complete implementation below:

```vue
<script setup lang="ts">
// Your implementation here
</script>

<template>
  <!-- Your template here -->
</template>
```

## Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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
    await vi.advanceTimersByTime(300)
    
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
    await vi.advanceTimersByTime(300)
    
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
    await vi.advanceTimersByTime(300)
    await vi.runAllTimers()
    
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
    await vi.advanceTimersByTime(300)
    await vi.runAllTimers()
    
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
    await vi.advanceTimersByTime(300)
    await vi.runAllTimers()
    
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
    await vi.advanceTimersByTime(300)
    await vi.runAllTimers()
    
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
    await vi.advanceTimersByTime(300)
    await vi.runAllTimers()
    
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
    await vi.advanceTimersByTime(300)
    
    expect(mockSearchFn).not.toHaveBeenCalled()
  })

  it('should use custom debounce delay', async () => {
    const wrapper = mount(DebouncedSearch, {
      props: { searchFn: mockSearchFn, debounceMs: 500 }
    })
    const input = wrapper.find('input')
    
    await input.setValue('test')
    await vi.advanceTimersByTime(400)
    expect(mockSearchFn).not.toHaveBeenCalled()
    
    await vi.advanceTimersByTime(100)
    expect(mockSearchFn).toHaveBeenCalled()
  })
})
```
