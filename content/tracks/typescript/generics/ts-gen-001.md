---
slug: ts-gen-001
title: Generic Function Basics
description: Create a generic function that works with any type.
difficulty: intermediate
hints:
  - Generic type parameters go in angle brackets before the function parameters
  - Use T as a conventional name for a single type parameter
  - The generic type can be used for parameters and return types
tags:
  - generics
  - functions
  - type-parameters
---

Create a generic identity function that returns whatever value is passed to it.

```typescript
function identity___blank_start___<T>___blank_end___(value: ___blank_start___T___blank_end___): ___blank_start___T___blank_end___ {
  return value;
}

const num = identity(42);        // type: number
const str = identity("hello");   // type: string
const arr = identity([1, 2, 3]); // type: number[]
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('works with numbers', () => {
  expect(identity(42)).toBe(42)
  expect(identity(0)).toBe(0)
})

test('works with strings', () => {
  expect(identity('hello')).toBe('hello')
})

test('works with arrays', () => {
  expect(identity([1, 2, 3])).toEqual([1, 2, 3])
})

test('works with objects', () => {
  const obj = { name: 'test' }
  expect(identity(obj)).toBe(obj)
})
```
