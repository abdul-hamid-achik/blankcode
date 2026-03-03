---
slug: ts-challenge-004
title: 'Challenge: Build a Type-Safe Event Emitter'
description: Create a strongly-typed event emitter with proper TypeScript generics.
difficulty: advanced
type: challenge
tags:
  - generics
  - types
  - design-patterns
---

# Challenge: Type-Safe Event Emitter

## Requirements

Create an `EventEmitter` class with the following features:

1. **Generic type parameter** - Define event map interface
2. **on<K>(event: K, listener: Listener<K>): void** - Subscribe to events
3. **off<K>(event: K, listener: Listener<K>): void** - Unsubscribe from events
4. **emit<K>(event: K, ...args: Args<K>): void** - Emit events with type-safe arguments
5. **once<K>(event: K, listener: Listener<K>): void** - One-time subscription
6. **removeAllListeners<K>(event?: K): void** - Remove all listeners

## Constraints

- Full TypeScript type safety
- Listeners receive correct argument types
- Support multiple listeners per event
- once() listeners auto-remove after first emit
- Handle listener errors gracefully (don't stop other listeners)

## Example Usage

```typescript
interface Events {
  userLogin: (userId: string, timestamp: Date) => void
  userLogout: (userId: string) => void
  error: (message: string, code: number) => void
}

const emitter = new EventEmitter<Events>()

emitter.on('userLogin', (userId, timestamp) => {
  console.log(`${userId} logged in at ${timestamp}`)
})

emitter.emit('userLogin', 'user123', new Date())
```

Write your complete implementation below:

```typescript
// Your implementation here
```

## Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from './EventEmitter'

describe('EventEmitter', () => {
  interface TestEvents {
    simple: (value: string) => void
    multiple: (a: number, b: string, c: boolean) => void
    noArgs: () => void
  }

  it('should subscribe and emit events', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener = vi.fn()
    
    emitter.on('simple', listener)
    emitter.emit('simple', 'hello')
    
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('hello')
  })

  it('should handle multiple listeners', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    
    emitter.on('simple', listener1)
    emitter.on('simple', listener2)
    emitter.emit('simple', 'test')
    
    expect(listener1).toHaveBeenCalledWith('test')
    expect(listener2).toHaveBeenCalledWith('test')
  })

  it('should unsubscribe listeners', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener = vi.fn()
    
    emitter.on('simple', listener)
    emitter.off('simple', listener)
    emitter.emit('simple', 'test')
    
    expect(listener).not.toHaveBeenCalled()
  })

  it('should only call once listener once', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener = vi.fn()
    
    emitter.once('simple', listener)
    emitter.emit('simple', 'first')
    emitter.emit('simple', 'second')
    
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('first')
  })

  it('should handle multiple arguments', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener = vi.fn()
    
    emitter.on('multiple', listener)
    emitter.emit('multiple', 42, 'answer', true)
    
    expect(listener).toHaveBeenCalledWith(42, 'answer', true)
  })

  it('should handle events with no arguments', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener = vi.fn()
    
    emitter.on('noArgs', listener)
    emitter.emit('noArgs')
    
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('should remove all listeners for event', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    
    emitter.on('simple', listener1)
    emitter.on('simple', listener2)
    emitter.removeAllListeners('simple')
    
    emitter.emit('simple', 'test')
    
    expect(listener1).not.toHaveBeenCalled()
    expect(listener2).not.toHaveBeenCalled()
  })

  it('should remove all listeners for all events', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    
    emitter.on('simple', listener1)
    emitter.on('noArgs', listener2)
    emitter.removeAllListeners()
    
    emitter.emit('simple', 'test')
    emitter.emit('noArgs')
    
    expect(listener1).not.toHaveBeenCalled()
    expect(listener2).not.toHaveBeenCalled()
  })

  it('should handle listener errors gracefully', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener1 = vi.fn().mockImplementation(() => { throw new Error('Oops') })
    const listener2 = vi.fn()
    
    emitter.on('simple', listener1)
    emitter.on('simple', listener2)
    
    expect(() => emitter.emit('simple', 'test')).not.toThrow()
    expect(listener2).toHaveBeenCalledWith('test')
  })

  it('should type-check event arguments', () => {
    const emitter = new EventEmitter<TestEvents>()
    const listener = vi.fn()
    
    emitter.on('simple', listener)
    
    // @ts-expect-error - Wrong argument type
    // emitter.emit('simple', 123)
    
    // @ts-expect-error - Missing argument
    // emitter.emit('simple')
  })
})
```
