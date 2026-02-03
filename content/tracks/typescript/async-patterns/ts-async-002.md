---
slug: ts-async-002
title: Async/Await Basics
description: Convert a Promise chain to use async/await syntax.
difficulty: beginner
hints:
  - async functions always return a Promise
  - await pauses execution until the Promise resolves
  - Use try/catch for error handling with async/await
tags:
  - async
  - await
  - promises
---

Rewrite this function using async/await instead of Promise chains.

```typescript
interface User {
  id: number;
  name: string;
}

function fetchUser(id: number): Promise<User> {
  return Promise.resolve({ id, name: `User ${id}` });
}

___blank_start___async___blank_end___ function getUserName(id: number): Promise<string> {
  const user = ___blank_start___await fetchUser(id)___blank_end___;
  return ___blank_start___user.name___blank_end___;
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('returns user name', async () => {
  const name = await getUserName(1)
  expect(name).toBe('User 1')
})

test('works with different IDs', async () => {
  const name = await getUserName(42)
  expect(name).toBe('User 42')
})

test('returns a promise', () => {
  const result = getUserName(1)
  expect(result).toBeInstanceOf(Promise)
})
```
