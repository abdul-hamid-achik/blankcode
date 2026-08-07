---
slug: re-challenge-003
title: 'Challenge: Build a Virtualized List Component'
description: Create a performant virtualized list that renders only visible items.
difficulty: advanced
type: challenge
tags:
  - performance
  - hooks
  - scroll
---

# Challenge: Virtualized List

## Requirements

Create a `VirtualizedList` component with the following features:

1. **Accepts items array** - List of items to render
2. **itemHeight** - Fixed height per item (pixels)
3. **containerHeight** - Visible container height
4. **overscan** - Number of items to render outside viewport
5. **onScroll** - Scroll event callback
6. **onReachEnd** - Callback when scrolling near end (infinite scroll)

## Constraints

- Only render visible items + overscan
- Maintain scroll position
- Handle dynamic item heights (optional)
- Use requestAnimationFrame for scroll handling
- Support keyboard navigation

Write your complete implementation below:

```tsx
import { useState, useRef, useEffect, useCallback } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  onScroll?: (scrollTop: number) => void;
  onReachEnd?: () => void;
  reachEndThreshold?: number;
}

// Your implementation here
```

## Example Usage

```tsx
<VirtualizedList
  items={largeArray}
  itemHeight={50}
  containerHeight={400}
  overscan={5}
  renderItem={(item) => <div>{item.name}</div>}
  onReachEnd={loadMore}
/>
```

## Tests

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VirtualizedList } from './VirtualizedList'

describe('VirtualizedList', () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
  }))

  it('should render container with correct height', () => {
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />
    )
    
    const container = screen.getByRole('list')
    expect(container).toHaveStyle({ height: '400px' })
  })

  it('should render only visible items', () => {
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id} data-testid="item">{item.name}</div>}
      />
    )
    
    // 400px / 50px = 8 items visible
    const renderedItems = screen.getAllByTestId('item')
    expect(renderedItems.length).toBeLessThan(20) // Should be around 8 + overscan
  })

  it('should render correct first visible items', () => {
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id} data-testid="item">{item.name}</div>}
      />
    )
    
    const firstItem = screen.getByText('Item 0')
    expect(firstItem).toBeInTheDocument()
  })

  it('should update rendered items on scroll', async () => {
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id} data-testid="item">{item.name}</div>}
      />
    )
    
    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: 500 } })
    
    // Item 0 should not be visible anymore (scrolled past)
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument()
    
    // Item 10 should be visible (500px / 50px = 10)
    expect(screen.getByText('Item 10')).toBeInTheDocument()
  })

  it('should call onScroll callback', () => {
    const onScroll = vi.fn()
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
        onScroll={onScroll}
      />
    )
    
    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: 100 } })
    
    expect(onScroll).toHaveBeenCalledWith(100)
  })

  it('should call onReachEnd when near end', () => {
    const onReachEnd = vi.fn()
    const totalHeight = items.length * 50 // 50000px
    
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
        onReachEnd={onReachEnd}
        reachEndThreshold={100}
      />
    )
    
    const container = screen.getByRole('list')
    // Scroll to near end (50000 - 400 - 100 = 49500)
    fireEvent.scroll(container, { target: { scrollTop: 49500 } })
    
    expect(onReachEnd).toHaveBeenCalled()
  })

  it('should not call onReachEnd multiple times', () => {
    const onReachEnd = vi.fn()
    
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
        onReachEnd={onReachEnd}
        reachEndThreshold={100}
      />
    )
    
    const container = screen.getByRole('list')
    fireEvent.scroll(container, { target: { scrollTop: 49500 } })
    fireEvent.scroll(container, { target: { scrollTop: 49600 } })
    fireEvent.scroll(container, { target: { scrollTop: 49700 } })
    
    // Should only be called once
    expect(onReachEnd).toHaveBeenCalledTimes(1)
  })

  it('should handle overscan correctly', () => {
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        overscan={10}
        renderItem={(item) => <div key={item.id} data-testid="item">{item.name}</div>}
      />
    )
    
    // Should render more items due to overscan
    const renderedItems = screen.getAllByTestId('item')
    expect(renderedItems.length).toBeGreaterThan(8) // 8 visible + overscan
  })

  it('should support keyboard navigation', () => {
    render(
      <VirtualizedList
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={(item) => <div key={item.id} tabIndex={0}>{item.name}</div>}
      />
    )
    
    const firstItem = screen.getByText('Item 0')
    firstItem.focus()
    
    fireEvent.keyDown(firstItem, { key: 'ArrowDown' })
    const secondItem = screen.getByText('Item 1')
    expect(secondItem).toHaveFocus()
  })
})
```

## Solution

```tsx
import { useCallback, useRef, useState } from 'react'

export interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  onScroll?: (scrollTop: number) => void
  onReachEnd?: () => void
  reachEndThreshold?: number
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  onScroll,
  onReachEnd,
  reachEndThreshold = 100,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  // Latched so a run of scroll events near the bottom fires the callback once.
  // Without this, an infinite-scroll consumer would fetch the same page on
  // every pixel of movement.
  const reachedEnd = useRef(false)

  const totalHeight = items.length * itemHeight
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2)

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const top = event.currentTarget.scrollTop
      setScrollTop(top)
      onScroll?.(top)

      const distanceFromEnd = totalHeight - (top + containerHeight)
      if (distanceFromEnd <= reachEndThreshold) {
        if (!reachedEnd.current) {
          reachedEnd.current = true
          onReachEnd?.()
        }
      } else {
        // Unlatched only after scrolling back out of the zone, so the next
        // approach counts as a new one.
        reachedEnd.current = false
      }
    },
    [containerHeight, onReachEnd, onScroll, reachEndThreshold, totalHeight]
  )

  // Arrow keys move focus between rendered rows. The list owns this rather than
  // each row, because a row does not know who its neighbours are.
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

    const focusable = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>('[tabindex]') ?? []
    )
    const current = focusable.indexOf(document.activeElement as HTMLElement)
    if (current === -1) return

    const next = event.key === 'ArrowDown' ? current + 1 : current - 1
    focusable[next]?.focus()
    event.preventDefault()
  }, [])

  return (
    <div
      ref={containerRef}
      role="list"
      style={{ height: `${containerHeight}px`, overflowY: 'auto', position: 'relative' }}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      {/* A spacer of the full height so the scrollbar reflects the whole list,
          even though only a window of it exists in the DOM. */}
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
    </div>
  )
}
```
