---
slug: re-challenge-005
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

Create an `InfiniteScroll` component with the following features:

1. **fetchData callback** - Async function to fetch page of data
2. **itemHeight** - Fixed/predicted item height
3. **threshold** - How close to bottom before fetching
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

```tsx
<InfiniteScroll
  fetchData={async (page) => {
    const res = await fetch(`/api/items?page=${page}`)
    return res.json()
  }}
  itemHeight={60}
  threshold={200}
  cacheSize={10}
  renderItem={(item) => <ItemCard {...item} />}
/>
```

Write your complete implementation below:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';

// Your implementation here
```

## Tests

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
    })
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
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        threshold={100}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalledTimes(1)
    })
    
    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: 800 } }) // Near bottom
    
    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalledTimes(2)
    })
  })

  it('should cache fetched pages', async () => {
    mockFetchData.mockResolvedValue({
      items: [{ id: 1, name: 'Item 1' }],
      hasMore: true,
    })
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalledTimes(1)
    })
    
    // Scroll around
    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: 100 } })
    fireEvent.scroll(container, { target: { scrollTop: 0 } })
    
    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalledTimes(1) // Should not refetch
    })
  })

  it('should show loading state', async () => {
    mockFetchData.mockImplementation(() => new Promise(resolve => 
      setTimeout(() => resolve({ items: [], hasMore: true }), 100)
    ))
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should show error state and retry', async () => {
    mockFetchData.mockRejectedValueOnce(new Error('Failed to fetch'))
    mockFetchData.mockResolvedValueOnce({
      items: [{ id: 1, name: 'Item 1' }],
      hasMore: true,
    })
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Error loading items')).toBeInTheDocument()
    })
    
    const retryButton = screen.getByText('Retry')
    fireEvent.click(retryButton)
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })
  })

  it('should cleanup cache when exceeding cacheSize', async () => {
    mockFetchData.mockResolvedValue({
      items: [{ id: 1, name: 'Item 1' }],
      hasMore: true,
    })
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        cacheSize={2}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    // Simulate loading many pages
    const container = screen.getByRole('list')
    for (let i = 0; i < 10; i++) {
      fireEvent.scroll(container, { target: { scrollTop: i * 500 } })
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
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        enablePullToRefresh
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })
    
    // Pull down
    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: -100 } })
    
    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle empty results', async () => {
    mockFetchData.mockResolvedValue({
      items: [],
      hasMore: false,
    })
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('No more items')).toBeInTheDocument()
    })
  })

  it('should cancel pending request on unmount', async () => {
    let resolvePromise: (value: any) => void
    mockFetchData.mockImplementation(() => new Promise(resolve => {
      resolvePromise = resolve
    }))
    
    const { unmount } = render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    unmount()
    
    // Should not throw error when promise resolves after unmount
    resolvePromise!({ items: [], hasMore: true })
    
    // Test passes if no error is thrown
  })

  it('should maintain scroll position during data load', async () => {
    mockFetchData.mockResolvedValueOnce({
      items: Array(50).fill(null).map((_, i) => ({ id: i + 1, name: `Item ${i + 1}` })),
      hasMore: true,
    })
    
    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })
    
    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: 500 } })
    
    const scrollPosition = container.scrollTop
    
    // Trigger data load
    fireEvent.scroll(container, { target: { scrollTop: 2400 } })
    
    // Scroll position should be maintained (approximately)
    expect(container.scrollTop).toBeGreaterThanOrEqual(scrollPosition - 100)
  })
})
```
