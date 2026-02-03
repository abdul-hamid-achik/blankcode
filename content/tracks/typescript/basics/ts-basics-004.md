---
slug: ts-basics-004
title: Array Types
description: Work with typed arrays and array methods in TypeScript.
difficulty: beginner
hints:
  - Array types can be written as `Type[]` or `Array<Type>`
  - The filter callback receives each element
  - The map callback transforms each element
tags:
  - arrays
  - methods
  - basics
---

Complete the functions that work with typed arrays.

```typescript
function filterEvenNumbers(numbers: ___blank_start___number[]___blank_end___): number[] {
  return numbers.___blank_start___filter___blank_end___((n) => n % 2 === 0);
}

function doubleNumbers(numbers: number[]): number[] {
  return numbers.___blank_start___map___blank_end___((n) => ___blank_start___n * 2___blank_end___);
}

function sumNumbers(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('filters even numbers', () => {
  expect(filterEvenNumbers([1, 2, 3, 4, 5, 6])).toEqual([2, 4, 6])
  expect(filterEvenNumbers([1, 3, 5])).toEqual([])
  expect(filterEvenNumbers([2, 4])).toEqual([2, 4])
})

test('doubles numbers', () => {
  expect(doubleNumbers([1, 2, 3])).toEqual([2, 4, 6])
  expect(doubleNumbers([0, 5, 10])).toEqual([0, 10, 20])
})

test('sums numbers', () => {
  expect(sumNumbers([1, 2, 3, 4])).toBe(10)
  expect(sumNumbers([])).toBe(0)
})
```
