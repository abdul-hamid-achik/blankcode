---
slug: re-challenge-001
title: 'Challenge: Build a Custom useLocalStorage Hook'
description: Create a React hook that persists state to localStorage with proper typing.
difficulty: beginner
type: challenge
tags:
  - hooks
  - state-management
  - persistence
---

# Challenge: useLocalStorage Hook

## Requirements

Create a custom React hook `useLocalStorage` with the following features:

1. **Accepts two parameters**: `key` (string) and `initialValue` (any JSON-serializable value)
2. **Returns a tuple**: `[value, setValue]` similar to useState
3. **Persists to localStorage**: Value is saved to localStorage on change
4. **Reads from localStorage**: Initial value comes from localStorage if available
5. **Handles JSON serialization**: Properly stringify/parse values
6. **Type-safe**: Works with TypeScript generics

## Constraints

- Handle localStorage being unavailable (SSR, private browsing)
- Handle JSON parse errors gracefully
- Sync across tabs using storage event
- Don't use external libraries

## Example Usage

```tsx
const [name, setName] = useLocalStorage('name', 'Guest');
const [count, setCount] = useLocalStorage('count', 0);
```

Write your complete implementation below:

```tsx
import { useState, useEffect } from 'react';

// Your implementation here
```

## Tests

```tsx
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from './useLocalStorage'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value }),
    removeItem: jest.fn((key: string) => { delete store[key] }),
    clear: jest.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

beforeEach(() => {
  localStorageMock.clear()
  jest.clearAllMocks()
})

describe('useLocalStorage', () => {
  it('should initialize with provided default value', () => {
    const { result } = renderHook(() => useLocalStorage('test', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('should initialize with value from localStorage if available', () => {
    localStorageMock.getItem.mockReturnValue('"stored value"')
    const { result } = renderHook(() => useLocalStorage('test', 'default'))
    expect(result.current[0]).toBe('stored value')
    expect(localStorageMock.getItem).toHaveBeenCalledWith('test')
  })

  it('should save value to localStorage on update', () => {
    const { result } = renderHook(() => useLocalStorage('test', 'initial'))
    act(() => {
      result.current[1]('new value')
    })
    expect(result.current[0]).toBe('new value')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test', '"new value"')
  })

  it('should handle number values', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0))
    act(() => {
      result.current[1](42)
    })
    expect(result.current[0]).toBe(42)
  })

  it('should handle object values', () => {
    const { result } = renderHook(() => 
      useLocalStorage('user', { name: 'John', age: 30 })
    )
    act(() => {
      result.current[1]({ name: 'Jane', age: 25 })
    })
    expect(result.current[0]).toEqual({ name: 'Jane', age: 25 })
  })

  it('should handle null values', () => {
    const { result } = renderHook(() => useLocalStorage('value', null))
    act(() => {
      result.current[1](null)
    })
    expect(result.current[0]).toBe(null)
  })

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('Storage full')
    })
    const { result } = renderHook(() => useLocalStorage('test', 'value'))
    expect(() => {
      act(() => {
        result.current[1]('new value')
      })
    }).not.toThrow()
  })
})
```
