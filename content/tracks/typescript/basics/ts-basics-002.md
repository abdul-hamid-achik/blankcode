---
slug: ts-basics-002
title: Interface Definition
description: Define an interface to describe the shape of a user object.
difficulty: beginner
hints:
  - Interfaces use the `interface` keyword
  - Properties are defined with name followed by colon and type
  - Optional properties use `?` after the name
tags:
  - interfaces
  - objects
  - basics
---

Define an interface for a User object with the required properties.

```typescript
___blank_start___interface___blank_end___ User {
  id: ___blank_start___number___blank_end___;
  name: ___blank_start___string___blank_end___;
  email: string;
  age___blank_start___?___blank_end___: number;
}

function greetUser(user: User): string {
  return `Hello, ${user.name}!`;
}

const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com"
};
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('greets user by name', () => {
  const user: User = { id: 1, name: 'Bob', email: 'bob@test.com' }
  expect(greetUser(user)).toBe('Hello, Bob!')
})

test('accepts user with optional age', () => {
  const user: User = { id: 2, name: 'Carol', email: 'carol@test.com', age: 25 }
  expect(greetUser(user)).toBe('Hello, Carol!')
})

test('accepts user without age', () => {
  const user: User = { id: 3, name: 'Dave', email: 'dave@test.com' }
  expect(user.age).toBeUndefined()
})
```
