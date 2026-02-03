---
slug: ts-gen-003
title: Generic Array Utilities
description: Build generic utility functions for working with arrays.
difficulty: intermediate
hints:
  - Multiple generic type parameters can be used
  - Array.prototype methods work with generic arrays
  - Consider edge cases like empty arrays
tags:
  - generics
  - arrays
  - utilities
---

Implement generic array utility functions.

```typescript
function first<T>(arr: T[]): ___blank_start___T | undefined___blank_end___ {
  return ___blank_start___arr[0]___blank_end___;
}

function last<T>(arr: ___blank_start___T[]___blank_end___): T | undefined {
  return arr[___blank_start___arr.length - 1___blank_end___];
}

function reverse___blank_start___<T>___blank_end___(arr: T[]): T[] {
  return [...arr].reverse();
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('first returns first element', () => {
  expect(first([1, 2, 3])).toBe(1)
  expect(first(['a', 'b'])).toBe('a')
})

test('first returns undefined for empty array', () => {
  expect(first([])).toBeUndefined()
})

test('last returns last element', () => {
  expect(last([1, 2, 3])).toBe(3)
  expect(last(['a', 'b'])).toBe('b')
})

test('last returns undefined for empty array', () => {
  expect(last([])).toBeUndefined()
})

test('reverse creates new reversed array', () => {
  const original = [1, 2, 3]
  const reversed = reverse(original)
  expect(reversed).toEqual([3, 2, 1])
  expect(original).toEqual([1, 2, 3]) // original unchanged
})
```
