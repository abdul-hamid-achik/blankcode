---
slug: re-challenge-002
title: 'Challenge: Build a Debounced Search Component'
description: Create a search component with debounced API calls and proper loading states.
difficulty: intermediate
type: challenge
tags:
  - hooks
  - api
  - performance
---

# Challenge: Debounced Search Component

## Requirements

Create a `DebouncedSearch` component with the following features:

1. **Search input** - Text input for search queries
2. **Debounced search** - Wait 300ms after typing stops before searching
3. **Loading state** - Show loading indicator while searching
4. **Results display** - Display search results in a list
5. **Error handling** - Show error message if search fails
6. **Clear button** - Button to clear search and results

## Props

- `onSearch: (query: string) => Promise<SearchResult[]>` - Search function
- `placeholder?: string` - Input placeholder
- `debounceMs?: number` - Debounce delay (default 300)

## Constraints

- Cancel pending requests when new search starts
- Don't search empty queries
- Handle component unmount during async operations
- Use React hooks (useState, useEffect, useCallback, useRef)

Write your complete implementation below:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';

interface SearchResult {
  id: string;
  title: string;
}

interface DebouncedSearchProps {
  onSearch: (query: string) => Promise<SearchResult[]>;
  placeholder?: string;
  debounceMs?: number;
}

// Your implementation here
```

## Example Usage

```tsx
<DebouncedSearch
  onSearch={async (q) => fetch(`/api/search?q=${q}`).then(r => r.json())}
  placeholder="Search users..."
/>
```

## Tests

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DebouncedSearch } from './DebouncedSearch'

vi.useFakeTimers()

const mockOnSearch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

// `waitFor` polls on timers, so under fake timers it waits for a clock that is
// never advanced and eventually times out. Advancing inside `act` instead is
// deterministic: it moves the clock, flushes the promises that were waiting on
// it, and lets React apply the resulting state before the assertion runs.
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('DebouncedSearch', () => {
  it('should render input with placeholder', () => {
    render(<DebouncedSearch onSearch={mockOnSearch} placeholder="Search..." />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('should not search immediately on typing', () => {
    render(<DebouncedSearch onSearch={mockOnSearch} />)
    const input = screen.getByPlaceholderText('Search...')

    fireEvent.change(input, { target: { value: 'test' } })
    expect(mockOnSearch).not.toHaveBeenCalled()
  })

  it('should search after debounce delay', async () => {
    mockOnSearch.mockResolvedValue([{ id: '1', title: 'Result' }])

    render(<DebouncedSearch onSearch={mockOnSearch} />)
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'test' },
    })

    await advance(300)
    expect(mockOnSearch).toHaveBeenCalledWith('test')
  })

  it('should show loading state while searching', () => {
    mockOnSearch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    )

    render(<DebouncedSearch onSearch={mockOnSearch} />)
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'test' },
    })

    // Still within the debounce window, so the search has not run yet — but the
    // component already knows one is coming.
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should display search results', async () => {
    mockOnSearch.mockResolvedValue([
      { id: '1', title: 'Result 1' },
      { id: '2', title: 'Result 2' },
    ])

    render(<DebouncedSearch onSearch={mockOnSearch} />)
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'test' },
    })

    await advance(300)
    expect(screen.getByText('Result 1')).toBeInTheDocument()
    expect(screen.getByText('Result 2')).toBeInTheDocument()
  })

  it('should show error message on failure', async () => {
    mockOnSearch.mockRejectedValue(new Error('Search failed'))

    render(<DebouncedSearch onSearch={mockOnSearch} />)
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'test' },
    })

    await advance(300)
    expect(screen.getByText('Error: Search failed')).toBeInTheDocument()
  })

  it('should clear search on clear button click', async () => {
    mockOnSearch.mockResolvedValue([{ id: '1', title: 'Result' }])

    render(<DebouncedSearch onSearch={mockOnSearch} />)
    const input = screen.getByPlaceholderText('Search...')

    fireEvent.change(input, { target: { value: 'test' } })
    await advance(300)
    expect(screen.getByText('Result')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Clear'))
    expect(input).toHaveValue('')
    expect(screen.queryByText('Result')).not.toBeInTheDocument()
  })

  it('should not search empty queries', async () => {
    render(<DebouncedSearch onSearch={mockOnSearch} />)
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: '' },
    })

    await advance(300)
    expect(mockOnSearch).not.toHaveBeenCalled()
  })

  it('should use custom debounce delay', async () => {
    render(<DebouncedSearch onSearch={mockOnSearch} debounceMs={500} />)
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'test' },
    })

    await advance(400)
    expect(mockOnSearch).not.toHaveBeenCalled()

    await advance(100)
    expect(mockOnSearch).toHaveBeenCalled()
  })
})
```

## Solution

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'

export interface SearchResult {
  id: string
  title: string
}

export interface DebouncedSearchProps {
  onSearch: (query: string) => Promise<SearchResult[]>
  placeholder?: string
  debounceMs?: number
}

export function DebouncedSearch({
  onSearch,
  placeholder = 'Search...',
  debounceMs = 300,
}: DebouncedSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Identifies the most recent search so a slow earlier one cannot overwrite
  // the results of a later, faster one.
  const latest = useRef(0)

  useEffect(() => {
    if (query.trim() === '') {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const timer = setTimeout(() => {
      const id = ++latest.current
      onSearch(query)
        .then((found) => {
          if (id !== latest.current) return
          setResults(found)
          setLoading(false)
        })
        .catch((cause: unknown) => {
          if (id !== latest.current) return
          setError(cause instanceof Error ? cause.message : String(cause))
          setLoading(false)
        })
    }, debounceMs)

    // Every keystroke cancels the pending search, which is the whole point:
    // the request is for what the user stopped on, not what they passed through.
    return () => clearTimeout(timer)
  }, [query, debounceMs, onSearch])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
    setLoading(false)
    latest.current++
  }, [])

  return (
    <div>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <button type="button" onClick={clear}>
        Clear
      </button>

      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}

      <ul>
        {results.map((result) => (
          <li key={result.id}>{result.title}</li>
        ))}
      </ul>
    </div>
  )
}
```
