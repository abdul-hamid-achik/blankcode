---
slug: ts-basics-002
title: Interface Definition
description: Define an interface for a User object, inferring each property's type from how the property is used below it.
difficulty: beginner
hints:
  - Interfaces use the `interface` keyword
  - "Don't guess a property's type from its name — check how it's used below: `.toFixed()` only exists on `number`, `.toUpperCase()` only exists on `string`"
  - Optional properties use `?` after the name
tags:
  - interfaces
  - objects
  - basics
---

Define an interface for a User object. Two of its property types aren't given away by
the property name — read `formatUserId` and `greetUser` below to see what each property
is actually used as.

```typescript
___blank_start___interface___blank_end___ User {
  id: ___blank_start___number___blank_end___;
  name: ___blank_start___string___blank_end___;
  email: string;
  age___blank_start___?___blank_end___: number;
}

function formatUserId(user: User): string {
  return `#${user.id.toFixed(0).padStart(4, '0')}`;
}

function greetUser(user: User): string {
  return `Hello, ${user.name.toUpperCase()}!`;
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('formats user id with leading zeros', () => {
  const user: User = { id: 7, name: 'Bob', email: 'bob@test.com' }
  expect(formatUserId(user)).toBe('#0007')
})

test('greets user by name in uppercase', () => {
  const user: User = { id: 1, name: 'Bob', email: 'bob@test.com' }
  expect(greetUser(user)).toBe('Hello, BOB!')
})

test('accepts user with optional age', () => {
  const user: User = { id: 2, name: 'Carol', email: 'carol@test.com', age: 25 }
  expect(greetUser(user)).toBe('Hello, CAROL!')
})

test('accepts user without age', () => {
  const user: User = { id: 3, name: 'Dave', email: 'dave@test.com' }
  expect(user.age).toBeUndefined()
})
```
