---
slug: ts-basics-001
title: Type Annotations
description: Add type annotations to function parameters, and infer each return type from what the function actually computes.
difficulty: beginner
hints:
  - Function parameters need type annotations after the colon
  - The return type comes after the parameter list, also after a colon
  - "Don't guess the return type — read the `return` statement: a comparison like `a === b` produces a `boolean`, a template string produces a `string`"
tags:
  - types
  - functions
  - basics
---

Add the correct type annotations to these functions. The parameter types are given by
the shape's dimensions, but each return type has to be worked out from what the
function's `return` statement actually produces.

```typescript
function calculateArea(width___blank_start___: number___blank_end___, height: number): number {
  return width * height;
}

function isSquare(width: number, height: number): ___blank_start___boolean___blank_end___ {
  return width === height;
}

function describeShape(width: number, height: number): ___blank_start___string___blank_end___ {
  return isSquare(width, height) ? 'square' : `${width}x${height} rectangle`;
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('calculates area correctly', () => {
  expect(calculateArea(5, 10)).toBe(50)
  expect(calculateArea(3, 4)).toBe(12)
  expect(calculateArea(0, 100)).toBe(0)
})

test('handles decimal values', () => {
  expect(calculateArea(2.5, 4)).toBe(10)
})

test('identifies squares', () => {
  expect(isSquare(5, 5)).toBe(true)
  expect(isSquare(5, 10)).toBe(false)
})

test('describes shapes', () => {
  expect(describeShape(5, 5)).toBe('square')
  expect(describeShape(3, 4)).toBe('3x4 rectangle')
})
```
