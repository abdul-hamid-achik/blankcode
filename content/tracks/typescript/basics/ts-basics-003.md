---
slug: ts-basics-003
title: Union Types
description: Use union types to allow a variable to hold multiple types.
difficulty: beginner
hints:
  - Union types use the pipe `|` symbol between types
  - Type guards help narrow union types
  - typeof checks the runtime type of a value
tags:
  - unions
  - type-guards
  - basics
---

Complete the function that handles both string and number inputs.

```typescript
type StringOrNumber = ___blank_start___string | number___blank_end___;

function formatValue(value: StringOrNumber): string {
  if (___blank_start___typeof value === 'string'___blank_end___) {
    return value.toUpperCase();
  }
  return ___blank_start___value.toFixed(2)___blank_end___;
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('formats string values to uppercase', () => {
  expect(formatValue('hello')).toBe('HELLO')
  expect(formatValue('TypeScript')).toBe('TYPESCRIPT')
})

test('formats number values with 2 decimal places', () => {
  expect(formatValue(42)).toBe('42.00')
  expect(formatValue(3.14159)).toBe('3.14')
  expect(formatValue(0)).toBe('0.00')
})
```
