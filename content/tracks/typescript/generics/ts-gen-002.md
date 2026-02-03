---
slug: ts-gen-002
title: Generic Constraints
description: Use generic constraints to limit what types can be used.
difficulty: intermediate
hints:
  - Use `extends` to constrain a generic type
  - Constraints ensure the type has certain properties
  - You can constrain to interfaces or other types
tags:
  - generics
  - constraints
  - extends
---

Create a function that only accepts objects with a `length` property.

```typescript
interface HasLength {
  length: number;
}

function getLength___blank_start___<T extends HasLength>___blank_end___(item: T): number {
  return ___blank_start___item.length___blank_end___;
}

// These should work:
getLength("hello");      // string has length
getLength([1, 2, 3]);    // array has length
getLength({ length: 5 }); // object with length

// This would fail type checking:
// getLength(123); // number doesn't have length
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('gets length of string', () => {
  expect(getLength('hello')).toBe(5)
  expect(getLength('')).toBe(0)
})

test('gets length of array', () => {
  expect(getLength([1, 2, 3])).toBe(3)
  expect(getLength([])).toBe(0)
})

test('gets length of object with length property', () => {
  expect(getLength({ length: 10 })).toBe(10)
})
```
