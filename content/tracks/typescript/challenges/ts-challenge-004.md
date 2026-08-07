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

Write your complete implementation below:

```typescript
// Your implementation here
```

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

## Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from './solution'

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
    emitter.emit('simple', 123)

    // @ts-expect-error - Missing argument
    emitter.emit('simple')

    // The `@ts-expect-error` comments are the real subject here — the typecheck
    // gate fails if either call turns out to be legal. These assertions cover
    // the other half: rejecting a call at compile time must not change what the
    // emitter does at runtime, or the types would be lying about the behaviour.
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenNthCalledWith(1, 123)
    expect(listener).toHaveBeenNthCalledWith(2)
  })
})
```

## Solution

```typescript
/*
 * The constraint is written over `keyof Events` rather than as
 * `Record<string, ...>` on purpose: an interface has no implicit index
 * signature, so an interface of event signatures — which is exactly how
 * callers declare their event map — would never satisfy a Record.
 */
export class EventEmitter<Events extends { [K in keyof Events]: (...args: any[]) => void }> {
  // Sets, not arrays: subscribing the same listener twice should not make it
  // fire twice, and removal is then unambiguous.
  #listeners = new Map<keyof Events, Set<(...args: any[]) => void>>()

  on<K extends keyof Events>(event: K, listener: Events[K]): void {
    const existing = this.#listeners.get(event) ?? new Set()
    existing.add(listener)
    this.#listeners.set(event, existing)
  }

  off<K extends keyof Events>(event: K, listener: Events[K]): void {
    this.#listeners.get(event)?.delete(listener)
  }

  once<K extends keyof Events>(event: K, listener: Events[K]): void {
    const wrapper = ((...args: Parameters<Events[K]>) => {
      // Removed before calling, so a listener that emits the same event again
      // cannot re-enter itself.
      this.off(event, wrapper)
      listener(...args)
    }) as Events[K]

    this.on(event, wrapper)
  }

  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    const listeners = this.#listeners.get(event)
    if (!listeners) return

    // Copied first: a listener may unsubscribe itself or others, and mutating
    // the set mid-iteration would skip whoever came next.
    for (const listener of [...listeners]) {
      try {
        listener(...args)
      } catch {
        // One broken subscriber must not stop the rest from being told. The
        // emitter has no way to report this to a caller who did not opt in.
      }
    }
  }

  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event === undefined) {
      this.#listeners.clear()
      return
    }
    this.#listeners.delete(event)
  }
}
```
