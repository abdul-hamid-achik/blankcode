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

## Example Usage

```tsx
<DebouncedSearch
  onSearch={async (q) => fetch(`/api/search?q=${q}`).then(r => r.json())}
  placeholder="Search users..."
/>
```

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

## Tests

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { DebouncedSearch } from './DebouncedSearch'

jest.useFakeTimers()

const mockOnSearch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
})

describe('DebouncedSearch', () => {
  it('should render input with placeholder', () => {
    render(<DebouncedSearch onSearch={mockOnSearch} placeholder="Search..." />)
    const input = screen.getByPlaceholderText('Search...')
    expect(input).toBeInTheDocument()
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
    const input = screen.getByPlaceholderText('Search...')
    
    fireEvent.change(input, { target: { value: 'test' } })
    jest.advanceTimersByTime(300)
    
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('test')
    })
  })

  it('should show loading state while searching', async () => {
    mockOnSearch.mockImplementation(() => new Promise(resolve => 
      setTimeout(() => resolve([]), 100)
    ))
    
    render(<DebouncedSearch onSearch={mockOnSearch} />)
    const input = screen.getByPlaceholderText('Search...')
    
    fireEvent.change(input, { target: { value: 'test' } })
    jest.advanceTimersByTime(300)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should display search results', async () => {
    mockOnSearch.mockResolvedValue([
      { id: '1', title: 'Result 1' },
      { id: '2', title: 'Result 2' },
    ])
    
    render(<DebouncedSearch onSearch={mockOnSearch} />)
    const input = screen.getByPlaceholderText('Search...')
    
    fireEvent.change(input, { target: { value: 'test' } })
    jest.advanceTimersByTime(300)
    
    await waitFor(() => {
      expect(screen.getByText('Result 1')).toBeInTheDocument()
      expect(screen.getByText('Result 2')).toBeInTheDocument()
    })
  })

  it('should show error message on failure', async () => {
    mockOnSearch.mockRejectedValue(new Error('Search failed'))
    
    render(<DebouncedSearch onSearch={mockOnSearch} />)
    const input = screen.getByPlaceholderText('Search...')
    
    fireEvent.change(input, { target: { value: 'test' } })
    jest.advanceTimersByTime(300)
    
    await waitFor(() => {
      expect(screen.getByText('Error: Search failed')).toBeInTheDocument()
    })
  })

  it('should clear search on clear button click', async () => {
    mockOnSearch.mockResolvedValue([{ id: '1', title: 'Result' }])
    
    render(<DebouncedSearch onSearch={mockOnSearch} />)
    const input = screen.getByPlaceholderText('Search...')
    
    fireEvent.change(input, { target: { value: 'test' } })
    jest.advanceTimersByTime(300)
    
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument()
    })
    
    const clearButton = screen.getByText('Clear')
    fireEvent.click(clearButton)
    
    expect(input).toHaveValue('')
  })

  it('should not search empty queries', () => {
    render(<DebouncedSearch onSearch={mockOnSearch} />)
    const input = screen.getByPlaceholderText('Search...')
    
    fireEvent.change(input, { target: { value: '' } })
    jest.advanceTimersByTime(300)
    
    expect(mockOnSearch).not.toHaveBeenCalled()
  })

  it('should use custom debounce delay', () => {
    render(<DebouncedSearch onSearch={mockOnSearch} debounceMs={500} />)
    const input = screen.getByPlaceholderText('Search...')
    
    fireEvent.change(input, { target: { value: 'test' } })
    jest.advanceTimersByTime(400)
    expect(mockOnSearch).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(100)
    expect(mockOnSearch).toHaveBeenCalled()
  })
})
```
