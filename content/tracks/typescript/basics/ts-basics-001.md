---
slug: ts-basics-001
title: Type Annotations
description: Add proper type annotations to function parameters and return types.
difficulty: beginner
hints:
  - Function parameters need type annotations after the colon
  - The return type comes after the parameter list
  - Use `number` for numeric values
tags:
  - types
  - functions
  - basics
---

Add the correct type annotations to this function that calculates the area of a rectangle.

```typescript
function calculateArea(width___blank_start___: number___blank_end___, height___blank_start___: number___blank_end___)___blank_start___: number___blank_end___ {
  return width * height;
}

const area = calculateArea(5, 10);
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
```
