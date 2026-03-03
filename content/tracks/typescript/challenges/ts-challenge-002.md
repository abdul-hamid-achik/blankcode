---
slug: ts-challenge-002
title: 'Challenge: Generic Array Utilities'
description: Implement type-safe generic array utility functions from scratch.
difficulty: intermediate
type: challenge
tags:
  - generics
  - arrays
  - utility-functions
---

# Challenge: Generic Array Utilities

## Requirements

Implement the following generic array utility functions with proper TypeScript types:

1. **first<T>(arr: T[]): T | undefined** - Returns the first element or undefined
2. **last<T>(arr: T[]): T | undefined** - Returns the last element or undefined
3. **sum(arr: number[]): number** - Returns the sum of all numbers
4. **unique<T>(arr: T[]): T[]** - Returns array with duplicates removed
5. **groupBy<T, K extends string | number | symbol>(arr: T[], keyFn: (item: T) => K): Record<K, T[]>** - Groups array items by a key function

## Constraints

- All functions must be properly typed with generics where applicable
- Handle edge cases (empty arrays, undefined, etc.)
- Do not mutate the original arrays

## Example Usage

```typescript
first([1, 2, 3])        // Returns 1
last(['a', 'b', 'c'])   // Returns 'c'
sum([1, 2, 3, 4])       // Returns 10
unique([1, 1, 2, 3])    // Returns [1, 2, 3]

const words = ['apple', 'banana', 'cherry']
groupBy(words, w => w[0]) 
// Returns { a: ['apple'], b: ['banana'], c: ['cherry'] }
```

Write your complete implementation below:

```typescript
// Your implementation here
```

## Tests

```typescript
import { expect, test, describe } from 'vitest'

describe('first', () => {
  test('should return first element of array', () => {
    expect(first([1, 2, 3])).toBe(1)
    expect(first(['a', 'b', 'c'])).toBe('a')
  })

  test('should return undefined for empty array', () => {
    expect(first([])).toBeUndefined()
  })
})

describe('last', () => {
  test('should return last element of array', () => {
    expect(last([1, 2, 3])).toBe(3)
    expect(last(['a', 'b', 'c'])).toBe('c')
  })

  test('should return undefined for empty array', () => {
    expect(last([])).toBeUndefined()
  })
})

describe('sum', () => {
  test('should sum positive numbers', () => {
    expect(sum([1, 2, 3, 4])).toBe(10)
  })

  test('should handle negative numbers', () => {
    expect(sum([-1, -2, -3])).toBe(-6)
  })

  test('should return 0 for empty array', () => {
    expect(sum([])).toBe(0)
  })

  test('should handle mixed positive and negative', () => {
    expect(sum([10, -5, 3, -2])).toBe(6)
  })
})

describe('unique', () => {
  test('should remove duplicates from array', () => {
    expect(unique([1, 1, 2, 3, 3])).toEqual([1, 2, 3])
  })

  test('should work with strings', () => {
    expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
  })

  test('should return same array if no duplicates', () => {
    expect(unique([1, 2, 3])).toEqual([1, 2, 3])
  })

  test('should handle empty array', () => {
    expect(unique([])).toEqual([])
  })
})

describe('groupBy', () => {
  test('should group by first letter', () => {
    const words = ['apple', 'banana', 'apricot', 'blueberry']
    const grouped = groupBy(words, w => w[0])
    expect(grouped.a).toEqual(['apple', 'apricot'])
    expect(grouped.b).toEqual(['banana', 'blueberry'])
  })

  test('should group by length', () => {
    const words = ['a', 'bb', 'ccc', 'dd']
    const grouped = groupBy(words, w => w.length)
    expect(grouped[1]).toEqual(['a'])
    expect(grouped[2]).toEqual(['bb', 'dd'])
    expect(grouped[3]).toEqual(['ccc'])
  })

  test('should handle empty array', () => {
    expect(groupBy([], (x: any) => x)).toEqual({})
  })

  test('should group numbers by parity', () => {
    const nums = [1, 2, 3, 4, 5, 6]
    const grouped = groupBy(nums, n => n % 2 === 0 ? 'even' : 'odd')
    expect(grouped.odd).toEqual([1, 3, 5])
    expect(grouped.even).toEqual([2, 4, 6])
  })
})
```
