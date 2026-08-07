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

Write your complete implementation below:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';

// Your implementation here
```

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

## Tests

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InfiniteScroll } from './InfiniteScroll'

interface Row {
  id: number
  name: string
}

// Typed so the component's item type can be inferred from the prop; an
// untyped mock leaves T as unknown and every renderItem callback fails to
// compile.
const mockFetchData = vi.fn<(page: number) => Promise<{ items: Row[]; hasMore: boolean }>>()

beforeEach(() => {
  vi.clearAllMocks()
})

function page(from: number, count: number, hasMore: boolean) {
  return {
    items: Array.from({ length: count }, (_, i) => ({ id: from + i, name: `Item ${from + i}` })),
    hasMore,
  }
}

describe('InfiniteScroll', () => {
  it('should render initial items', async () => {
    mockFetchData.mockResolvedValue(page(1, 2, true))

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
    mockFetchData.mockResolvedValueOnce(page(1, 20, true))
    mockFetchData.mockResolvedValueOnce(page(21, 20, false))

    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        containerHeight={400}
        threshold={100}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )

    await waitFor(() => expect(mockFetchData).toHaveBeenCalledTimes(1))

    fireEvent.scroll(screen.getByRole('list'), { target: { scrollTop: 800 } })

    await waitFor(() => expect(mockFetchData).toHaveBeenCalledTimes(2))
  })

  it('should not refetch a list that does not overflow its container', async () => {
    mockFetchData.mockResolvedValue(page(1, 1, true))

    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )

    await waitFor(() => expect(mockFetchData).toHaveBeenCalledTimes(1))

    // One 50px row cannot be scrolled inside a 400px window, so no amount of
    // scroll events means the reader reached the end of anything.
    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: 100 } })
    fireEvent.scroll(container, { target: { scrollTop: 0 } })

    expect(mockFetchData).toHaveBeenCalledTimes(1)
  })

  it('should show loading state', () => {
    mockFetchData.mockImplementation(() => new Promise(() => {}))

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
    mockFetchData.mockResolvedValueOnce(page(1, 1, true))

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

    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })
  })

  it('should only render the items in view', async () => {
    mockFetchData.mockResolvedValue(page(1, 200, false))

    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => (
          <div key={item.id} data-testid="row">
            {item.name}
          </div>
        )}
      />
    )

    await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument())

    // 400px / 50px is eight rows, plus overscan — nowhere near two hundred.
    expect(screen.getAllByTestId('row').length).toBeLessThan(30)
  })

  it('should support pull-to-refresh', async () => {
    mockFetchData.mockResolvedValue(page(1, 1, false))

    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        enablePullToRefresh
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )

    await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument())

    fireEvent.scroll(screen.getByRole('list'), { target: { scrollTop: -100 } })

    await waitFor(() => expect(mockFetchData).toHaveBeenCalledTimes(2))
  })

  it('should handle empty results', async () => {
    mockFetchData.mockResolvedValue({ items: [], hasMore: false })

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

  it('should ignore a request that resolves after unmount', async () => {
    let resolvePromise: (value: { items: Row[]; hasMore: boolean }) => void = () => {}
    mockFetchData.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        })
    )

    const { unmount } = render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )

    unmount()

    // Setting state on an unmounted component is the bug this guards: it warns
    // in development and leaks the component. The assertion is that resolving
    // late is simply a no-op.
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => resolvePromise({ items: [], hasMore: true })).not.toThrow()
    await Promise.resolve()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('should maintain scroll position during data load', async () => {
    mockFetchData.mockResolvedValue(page(1, 50, true))

    render(
      <InfiniteScroll
        fetchData={mockFetchData}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )

    await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument())

    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: 500 } })
    const before = container.scrollTop

    fireEvent.scroll(container, { target: { scrollTop: 2400 } })

    expect(container.scrollTop).toBeGreaterThanOrEqual(before - 100)
  })
})
```

## Solution

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'

export interface Page<T> {
  items: T[]
  hasMore: boolean
}

export interface InfiniteScrollProps<T> {
  fetchData: (page: number) => Promise<Page<T>>
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  containerHeight?: number
  threshold?: number
  overscan?: number
  enablePullToRefresh?: boolean
}

export function InfiniteScroll<T>({
  fetchData,
  itemHeight,
  renderItem,
  containerHeight = 400,
  threshold = 100,
  overscan = 3,
  enablePullToRefresh = false,
}: InfiniteScrollProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const nextPage = useRef(1)
  const loadingRef = useRef(false)
  // Pages already requested, so a burst of scroll events near the bottom does
  // not ask for the same page several times.
  const requested = useRef(new Set<number>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(
    async (pageNumber: number, replace = false) => {
      if (loadingRef.current) return
      if (!replace && requested.current.has(pageNumber)) return

      loadingRef.current = true
      requested.current.add(pageNumber)
      setLoading(true)
      setError(null)

      try {
        const result = await fetchData(pageNumber)
        // The component may be gone by the time this resolves; setting state
        // then warns in development and keeps the tree alive for nothing.
        if (!mounted.current) return
        setItems((previous) => (replace ? result.items : [...previous, ...result.items]))
        setHasMore(result.hasMore)
        nextPage.current = pageNumber + 1
      } catch (cause) {
        if (!mounted.current) return
        setError(cause instanceof Error ? cause.message : String(cause))
        // Dropped from the set so Retry is allowed to ask for it again.
        requested.current.delete(pageNumber)
      } finally {
        loadingRef.current = false
        if (mounted.current) setLoading(false)
      }
    },
    [fetchData]
  )

  useEffect(() => {
    void load(1)
  }, [load])

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const top = event.currentTarget.scrollTop
      setScrollTop(Math.max(0, top))

      if (enablePullToRefresh && top < 0) {
        requested.current.clear()
        nextPage.current = 1
        void load(1, true)
        return
      }

      const totalHeight = items.length * itemHeight
      // A list shorter than its container cannot be scrolled to its end, so a
      // scroll event on one says nothing about wanting more.
      if (totalHeight <= containerHeight) return
      if (!hasMore || loadingRef.current) return

      if (totalHeight - (top + containerHeight) <= threshold) {
        void load(nextPage.current)
      }
    },
    [containerHeight, enablePullToRefresh, hasMore, itemHeight, items.length, load, threshold]
  )

  const totalHeight = items.length * itemHeight
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2)

  return (
    <div
      role="list"
      style={{ height: `${containerHeight}px`, overflowY: 'auto', position: 'relative' }}
      onScroll={handleScroll}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {items.slice(startIndex, endIndex).map((item, offset) => {
          const index = startIndex + offset
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: `${index * itemHeight}px`,
                height: `${itemHeight}px`,
                width: '100%',
              }}
            >
              {renderItem(item, index)}
            </div>
          )
        })}
      </div>

      {loading && <div>Loading...</div>}

      {error && (
        <div>
          <span>Error loading items</span>
          <button type="button" onClick={() => void load(nextPage.current)}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && !hasMore && items.length === 0 && <div>No more items</div>}
    </div>
  )
}
```
