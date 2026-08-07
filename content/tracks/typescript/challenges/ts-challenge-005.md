---
slug: ts-challenge-005
title: 'Challenge: Build a Mini Redux Store'
description: Implement a type-safe state management store with Redux patterns.
difficulty: advanced
type: challenge
tags:
  - state-management
  - generics
  - design-patterns
---

# Challenge: Mini Redux Store

## Requirements

Create a `createStore` function with the following features:

1. **createStore<T>(reducer: Reducer<T>, initialState: T): Store<T>** - Create a store
2. **getState(): T** - Get current state
3. **dispatch(action: Action): void** - Dispatch actions
4. **subscribe(listener: () => void): () => void** - Subscribe to state changes
5. **Middleware support** - Apply middleware to dispatch

## Constraints

- Full TypeScript type safety
- Immutable state updates
- Middleware chain support
- Unsubscribe function from subscribe()
- Action types must be string literals

Write your complete implementation below:

```typescript
// Your implementation here
```

## Example Usage

```typescript
interface CounterState { count: number }
type Action = { type: 'INCREMENT' } | { type: 'DECREMENT' }

const store = createStore<CounterState>(
  (state, action) => {
    switch (action.type) {
      case 'INCREMENT': return { count: state.count + 1 }
      case 'DECREMENT': return { count: state.count - 1 }
      default: return state
    }
  },
  { count: 0 }
)

store.dispatch({ type: 'INCREMENT' })
console.log(store.getState()) // { count: 1 }
```

## Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createStore } from './solution'

describe('createStore', () => {
  it('should initialize with provided state', () => {
    const reducer = (state: any) => state
    const store = createStore(reducer, { count: 0 })
    expect(store.getState()).toEqual({ count: 0 })
  })

  it('should return updated state after dispatch', () => {
    const reducer = (state: { count: number }, action: { type: string }) => {
      if (action.type === 'INCREMENT') {
        return { count: state.count + 1 }
      }
      return state
    }
    const store = createStore(reducer, { count: 0 })
    
    store.dispatch({ type: 'INCREMENT' })
    expect(store.getState()).toEqual({ count: 1 })
  })

  it('should notify subscribers on state change', () => {
    const reducer = (state: any, action: any) => {
      if (action.type === 'CHANGE') return { value: 'updated' }
      return state
    }
    const store = createStore(reducer, { value: 'initial' })
    const listener = vi.fn()
    
    store.subscribe(listener)
    store.dispatch({ type: 'CHANGE' })
    
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('should unsubscribe correctly', () => {
    const reducer = (state: any, action: any) => {
      if (action.type === 'CHANGE') return { value: 'updated' }
      return state
    }
    const store = createStore(reducer, { value: 'initial' })
    const listener = vi.fn()
    
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    
    store.dispatch({ type: 'CHANGE' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('should support multiple subscribers', () => {
    const reducer = (state: any, action: any) => {
      if (action.type === 'CHANGE') return { value: 'updated' }
      return state
    }
    const store = createStore(reducer, { value: 'initial' })
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    
    store.subscribe(listener1)
    store.subscribe(listener2)
    
    store.dispatch({ type: 'CHANGE' })
    
    expect(listener1).toHaveBeenCalledTimes(1)
    expect(listener2).toHaveBeenCalledTimes(1)
  })

  it('should support middleware', () => {
    const reducer = (state: any, action: any) => {
      if (action.type === 'ADD') return { value: state.value + action.payload }
      return state
    }
    
    const loggerMiddleware = (store: any) => (next: any) => (action: any) => {
      console.log('Dispatching:', action)
      return next(action)
    }
    
    const store = createStore(reducer, { value: 0 }, [loggerMiddleware])
    store.dispatch({ type: 'ADD', payload: 5 })
    
    expect(store.getState().value).toBe(5)
  })

  it('should support middleware chain', () => {
    const calls: string[] = []
    
    const middleware1 = () => (next: any) => (action: any) => {
      calls.push('middleware1-before')
      const result = next(action)
      calls.push('middleware1-after')
      return result
    }
    
    const middleware2 = () => (next: any) => (action: any) => {
      calls.push('middleware2-before')
      const result = next(action)
      calls.push('middleware2-after')
      return result
    }
    
    const reducer = (state: any) => state
    createStore(reducer, {}, [middleware1, middleware2])
    
    expect(calls).toEqual([
      'middleware1-before',
      'middleware2-before',
      'middleware2-after',
      'middleware1-after',
    ])
  })

  it('should maintain immutability', () => {
    const reducer = (state: { data: number[] }, action: any) => {
      if (action.type === 'ADD') {
        return { data: [...state.data, action.value] }
      }
      return state
    }
    
    const store = createStore(reducer, { data: [1, 2, 3] })
    const initialState = store.getState()
    
    store.dispatch({ type: 'ADD', value: 4 })
    
    expect(initialState.data).toEqual([1, 2, 3])
    expect(store.getState().data).toEqual([1, 2, 3, 4])
  })
})
```

## Solution

```typescript
export type Action = { type: string; [key: string]: any }
export type Reducer<T> = (state: T, action: Action) => T
export type Middleware<T> = (
  store: { getState: () => T; dispatch: (action: Action) => any }
) => (next: (action: Action) => any) => (action: Action) => any

export interface Store<T> {
  getState: () => T
  dispatch: (action: Action) => void
  subscribe: (listener: () => void) => () => void
}

const INIT: Action = { type: '@@blankcode/INIT' }

export function createStore<T>(
  reducer: Reducer<T>,
  initialState: T,
  middlewares: Middleware<T>[] = []
): Store<T> {
  let state = initialState
  const listeners = new Set<() => void>()

  const baseDispatch = (action: Action): Action => {
    // The reducer returns the next state rather than mutating this one, which
    // is what lets a caller hold on to an earlier getState() safely.
    state = reducer(state, action)
    for (const listener of [...listeners]) listener()
    return action
  }

  const storeApi = {
    getState: () => state,
    dispatch: (action: Action) => dispatch(action),
  }

  // Composed in reverse so the first middleware in the array ends up outermost,
  // and its before/after work brackets everything after it.
  let dispatch: (action: Action) => any = baseDispatch
  for (let i = middlewares.length - 1; i >= 0; i--) {
    dispatch = middlewares[i]!(storeApi)(dispatch)
  }

  // Populates the state from the reducer's own defaults and lets middleware see
  // that the store has started.
  dispatch(INIT)

  return {
    getState: () => state,
    dispatch: (action: Action) => {
      dispatch(action)
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
```
