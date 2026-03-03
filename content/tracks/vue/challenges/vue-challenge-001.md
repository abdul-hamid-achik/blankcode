---
slug: vue-challenge-001
title: 'Challenge: Build a Custom useLocalStorage Composable'
description: Create a Vue composable that persists reactive state to localStorage.
difficulty: beginner
type: challenge
tags:
  - composables
  - reactivity
  - persistence
---

# Challenge: useLocalStorage Composable

## Requirements

Create a Vue composable `useLocalStorage` with the following features:

1. **Accepts two parameters**: `key` (string) and `initialValue` (any JSON-serializable value)
2. **Returns a ref**: Reactive reference that syncs with localStorage
3. **Persists to localStorage**: Value is saved on change
4. **Reads from localStorage**: Initial value comes from localStorage if available
5. **Handles JSON serialization**: Properly stringify/parse values
6. **Type-safe**: Works with TypeScript generics

## Constraints

- Handle localStorage being unavailable (SSR, private browsing)
- Handle JSON parse errors gracefully
- Sync across tabs using storage event
- Use Vue 3 Composition API

## Example Usage

```vue
<script setup lang="ts">
const name = useLocalStorage('name', 'Guest')
const count = useLocalStorage('count', 0)
</script>
```

Write your complete implementation below:

```vue
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

// Your implementation here
</script>
```

## Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLocalStorage } from './useLocalStorage'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

describe('useLocalStorage', () => {
  it('should initialize with provided default value', () => {
    const value = useLocalStorage('test', 'default')
    expect(value.value).toBe('default')
  })

  it('should initialize with value from localStorage if available', () => {
    localStorageMock.getItem.mockReturnValue('"stored value"')
    const value = useLocalStorage('test', 'default')
    expect(value.value).toBe('stored value')
    expect(localStorageMock.getItem).toHaveBeenCalledWith('test')
  })

  it('should save value to localStorage on change', async () => {
    const value = useLocalStorage('test', 'initial')
    value.value = 'new value'
    await vi.nextTick()
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test', '"new value"')
  })

  it('should handle number values', async () => {
    const value = useLocalStorage('count', 0)
    value.value = 42
    await vi.nextTick()
    expect(value.value).toBe(42)
    expect(localStorageMock.setItem).toHaveBeenCalledWith('count', '42')
  })

  it('should handle object values', async () => {
    const value = useLocalStorage('user', { name: 'John', age: 30 })
    value.value = { name: 'Jane', age: 25 }
    await vi.nextTick()
    expect(value.value).toEqual({ name: 'Jane', age: 25 })
  })

  it('should handle null values', async () => {
    const value = useLocalStorage('value', null)
    value.value = null
    await vi.nextTick()
    expect(value.value).toBe(null)
  })

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('Storage full')
    })
    const value = useLocalStorage('test', 'value')
    expect(() => {
      value.value = 'new value'
    }).not.toThrow()
  })

  it('should sync across tabs', async () => {
    const value = useLocalStorage('test', 'initial')
    
    // Simulate storage event from another tab
    const event = new StorageEvent('storage', {
      key: 'test',
      newValue: '"updated in other tab"',
    })
    window.dispatchEvent(event)
    await vi.nextTick()
    
    expect(value.value).toBe('updated in other tab')
  })
})
```
