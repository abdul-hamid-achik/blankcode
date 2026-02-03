---
slug: ts-gen-004
title: Generic Classes
description: Create a generic Stack class with type-safe push and pop operations.
difficulty: advanced
hints:
  - Classes can have generic type parameters too
  - Private fields can use the generic type
  - Methods can reference the class's generic type
tags:
  - generics
  - classes
  - data-structures
---

Implement a generic Stack class.

```typescript
class Stack___blank_start___<T>___blank_end___ {
  private items: ___blank_start___T[]___blank_end___ = [];

  push(item: ___blank_start___T___blank_end___): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return ___blank_start___this.items.pop()___blank_end___;
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return ___blank_start___this.items.length === 0___blank_end___;
  }

  get size(): number {
    return this.items.length;
  }
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('push adds items', () => {
  const stack = new Stack<number>()
  stack.push(1)
  stack.push(2)
  expect(stack.size).toBe(2)
})

test('pop removes and returns last item', () => {
  const stack = new Stack<string>()
  stack.push('a')
  stack.push('b')
  expect(stack.pop()).toBe('b')
  expect(stack.size).toBe(1)
})

test('pop returns undefined for empty stack', () => {
  const stack = new Stack<number>()
  expect(stack.pop()).toBeUndefined()
})

test('peek returns last item without removing', () => {
  const stack = new Stack<number>()
  stack.push(1)
  stack.push(2)
  expect(stack.peek()).toBe(2)
  expect(stack.size).toBe(2)
})

test('isEmpty returns correct state', () => {
  const stack = new Stack<number>()
  expect(stack.isEmpty()).toBe(true)
  stack.push(1)
  expect(stack.isEmpty()).toBe(false)
})
```
