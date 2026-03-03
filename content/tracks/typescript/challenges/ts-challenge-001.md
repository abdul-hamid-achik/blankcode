---
slug: ts-challenge-001
title: 'Challenge: Build a Type-Safe Counter'
description: Implement a counter class with proper TypeScript types from scratch.
difficulty: beginner
type: challenge
tags:
  - types
  - classes
  - basics
---

# Challenge: Type-Safe Counter

## Requirements

Create a `Counter` class that tracks a numeric count with the following features:

1. **Private count property** - Should store the current count value
2. **Constructor** - Optionally accepts an initial count (defaults to 0)
3. **increment()** - Increases count by 1 and returns the new value
4. **decrement()** - Decreases count by 1 and returns the new value
5. **getValue()** - Returns the current count without modifying it
6. **reset()** - Resets count to 0 and returns void

## Constraints

- The count must be a `number` type
- All methods must have proper type annotations
- The class should prevent negative counts (throw an error if decrement would go below 0)

## Example Usage

```typescript
const counter = new Counter(5);
counter.increment(); // Returns 6
counter.decrement(); // Returns 5
counter.getValue();  // Returns 5
counter.reset();     // Returns void, count is now 0
```

Write your complete implementation below:

```typescript
export class Counter {
  // Your implementation here
}
```

## Tests

```typescript
import { expect, test, describe } from 'vitest'

describe('Counter', () => {
  test('should initialize with default value of 0', () => {
    const counter = new Counter()
    expect(counter.getValue()).toBe(0)
  })

  test('should initialize with provided initial value', () => {
    const counter = new Counter(10)
    expect(counter.getValue()).toBe(10)
  })

  test('should increment correctly', () => {
    const counter = new Counter(5)
    expect(counter.increment()).toBe(6)
    expect(counter.increment()).toBe(7)
  })

  test('should decrement correctly', () => {
    const counter = new Counter(10)
    expect(counter.decrement()).toBe(9)
    expect(counter.decrement()).toBe(8)
  })

  test('should return current value without modifying', () => {
    const counter = new Counter(5)
    expect(counter.getValue()).toBe(5)
    expect(counter.getValue()).toBe(5)
  })

  test('should reset to 0', () => {
    const counter = new Counter(100)
    counter.reset()
    expect(counter.getValue()).toBe(0)
  })

  test('should throw error when decrement would go below 0', () => {
    const counter = new Counter(0)
    expect(() => counter.decrement()).toThrow('Count cannot be negative')
  })

  test('should handle multiple operations in sequence', () => {
    const counter = new Counter()
    counter.increment()
    counter.increment()
    counter.decrement()
    expect(counter.getValue()).toBe(1)
  })
})
```
