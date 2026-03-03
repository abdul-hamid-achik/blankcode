---
slug: vue-challenge-005
title: 'Challenge: Build an Infinite Scroll with Data Fetching'
description: Create a performant infinite scroll component with data fetching and caching.
difficulty: expert
type: challenge
tags:
  - performance
  - data-fetching
  - caching
---

# Challenge: Infinite Scroll with Caching

## Requirements

Create an `InfiniteScroll` Vue component with the following features:

1. **fetchData prop** - Async function to fetch page of data
2. **itemHeight prop** - Fixed/predicted item height
3. **threshold prop** - How close to bottom before fetching
4. **Cache results** - Don't refetch loaded pages
5. **Loading states** - Per-page loading indicators
6. **Error handling** - Retry failed pages
7. **Virtual scrolling** - Only render visible items

## Constraints

- Cancel pending requests on unmount
- Handle scroll position during data loading
- Support pull-to-refresh
- Debounce scroll events
- Memory-efficient (cleanup old cache)

## Example Usage

```vue
<InfiniteScroll
  :fetch-data="fetchItems"
  :item-height="60"
  :threshold="200"
  :cache-size="10"
>
  <template #item="{ item }">
    <ItemCard :item="item" />
  </template>
</InfiniteScroll>
```

Write your complete implementation below:

```vue
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// Your implementation here
</script>

<template>
  <!-- Your template here -->
</template>
```

## Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { InfiniteScroll } from './InfiniteScroll'

vi.useFakeTimers()

const mockFetchData = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InfiniteScroll', () => {
  it('should render initial items', async () => {
    mockFetchData.mockResolvedValue({
      items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
      hasMore: true,
    })
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
      },
      slots: {
        item: '<div :key="item.id">{{ item.name }}</div>',
      },
    })
    
    await vi.runAllTimers()
    
    expect(wrapper.text()).toContain('Item 1')
    expect(wrapper.text()).toContain('Item 2')
  })

  it('should fetch next page when scrolling near bottom', async () => {
    mockFetchData.mockResolvedValueOnce({
      items: Array(20).fill(null).map((_, i) => ({ id: i + 1, name: `Item ${i + 1}` })),
      hasMore: true,
    })
    mockFetchData.mockResolvedValueOnce({
      items: Array(20).fill(null).map((_, i) => ({ id: i + 21, name: `Item ${i + 21}` })),
      hasMore: false,
    })
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
        threshold: 100,
      },
      slots: {
        item: '<div :key="item.id">{{ item.name }}</div>',
      },
    })
    
    await vi.runAllTimers()
    expect(mockFetchData).toHaveBeenCalledTimes(1)
    
    const container = wrapper.find('[role="list"]')
    await container.trigger('scroll', { target: { scrollTop: 800 } })
    
    await vi.runAllTimers()
    expect(mockFetchData).toHaveBeenCalledTimes(2)
  })

  it('should cache fetched pages', async () => {
    mockFetchData.mockResolvedValue({
      items: [{ id: 1, name: 'Item 1' }],
      hasMore: true,
    })
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
      },
      slots: {
        item: '<div :key="item.id">{{ item.name }}</div>',
      },
    })
    
    await vi.runAllTimers()
    expect(mockFetchData).toHaveBeenCalledTimes(1)
    
    // Scroll around
    const container = wrapper.find('[role="list"]')
    await container.trigger('scroll', { target: { scrollTop: 100 } })
    await container.trigger('scroll', { target: { scrollTop: 0 } })
    
    await vi.runAllTimers()
    expect(mockFetchData).toHaveBeenCalledTimes(1) // Should not refetch
  })

  it('should show loading state', async () => {
    mockFetchData.mockImplementation(() => new Promise(resolve => 
      setTimeout(() => resolve({ items: [], hasMore: true }), 100)
    ))
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
      },
      slots: {
        item: '<div>{{ item.name }}</div>',
      },
    })
    
    expect(wrapper.text()).toContain('Loading...')
  })

  it('should show error state and retry', async () => {
    mockFetchData.mockRejectedValueOnce(new Error('Failed to fetch'))
    mockFetchData.mockResolvedValueOnce({
      items: [{ id: 1, name: 'Item 1' }],
      hasMore: true,
    })
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
      },
      slots: {
        item: '<div :key="item.id">{{ item.name }}</div>',
      },
    })
    
    await vi.runAllTimers()
    expect(wrapper.text()).toContain('Error loading items')
    
    const retryButton = wrapper.find('button')
    await retryButton.trigger('click')
    
    await vi.runAllTimers()
    expect(wrapper.text()).toContain('Item 1')
  })

  it('should cleanup cache when exceeding cacheSize', async () => {
    mockFetchData.mockResolvedValue({
      items: [{ id: 1, name: 'Item 1' }],
      hasMore: true,
    })
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
        cacheSize: 2,
      },
      slots: {
        item: '<div :key="item.id">{{ item.name }}</div>',
      },
    })
    
    // Simulate loading many pages
    const container = wrapper.find('[role="list"]')
    for (let i = 0; i < 10; i++) {
      await container.trigger('scroll', { target: { scrollTop: i * 500 } })
      await vi.advanceTimersByTimeAsync(100)
    }
    
    // Should have cleaned up old pages
    expect(mockFetchData).toHaveBeenCalledTimes(2) // Initial + cacheSize
  })

  it('should support pull-to-refresh', async () => {
    mockFetchData.mockResolvedValue({
      items: [{ id: 1, name: 'Item 1' }],
      hasMore: false,
    })
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
        enablePullToRefresh: true,
      },
      slots: {
        item: '<div :key="item.id">{{ item.name }}</div>',
      },
    })
    
    await vi.runAllTimers()
    expect(wrapper.text()).toContain('Item 1')
    
    // Pull down
    const container = wrapper.find('[role="list"]')
    await container.trigger('scroll', { target: { scrollTop: -100 } })
    
    await vi.runAllTimers()
    expect(mockFetchData).toHaveBeenCalledTimes(2)
  })

  it('should handle empty results', async () => {
    mockFetchData.mockResolvedValue({
      items: [],
      hasMore: false,
    })
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
      },
      slots: {
        item: '<div>{{ item.name }}</div>',
      },
    })
    
    await vi.runAllTimers()
    expect(wrapper.text()).toContain('No more items')
  })

  it('should cancel pending request on unmount', async () => {
    let resolvePromise: (value: any) => void
    mockFetchData.mockImplementation(() => new Promise(resolve => {
      resolvePromise = resolve
    }))
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
      },
      slots: {
        item: '<div>{{ item.name }}</div>',
      },
    })
    
    wrapper.unmount()
    
    // Should not throw error when promise resolves after unmount
    resolvePromise!({ items: [], hasMore: true })
    
    // Test passes if no error is thrown
  })

  it('should emit scroll event', async () => {
    mockFetchData.mockResolvedValue({
      items: [],
      hasMore: true,
    })
    
    const wrapper = mount(InfiniteScroll, {
      props: {
        fetchData: mockFetchData,
        itemHeight: 50,
      },
      slots: {
        item: '<div>{{ item.name }}</div>',
      },
    })
    
    await vi.runAllTimers()
    
    const container = wrapper.find('[role="list"]')
    await container.trigger('scroll', { target: { scrollTop: 100 } })
    
    expect(wrapper.emitted('scroll')).toBeDefined()
  })
})
```
