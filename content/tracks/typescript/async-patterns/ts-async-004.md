---
slug: ts-async-004
title: Promise.all for Parallel Requests
description: Use Promise.all to execute multiple async operations in parallel.
difficulty: intermediate
hints:
  - Promise.all takes an array of promises
  - It resolves when all promises resolve
  - The result is an array of resolved values in the same order
tags:
  - promises
  - parallel
  - performance
---

Fetch multiple users in parallel using Promise.all.

```typescript
interface User {
  id: number;
  name: string;
}

async function fetchUser(id: number): Promise<User> {
  return { id, name: `User ${id}` };
}

async function fetchAllUsers(ids: number[]): Promise<User[]> {
  const promises = ids.___blank_start___map___blank_end___((id) => ___blank_start___fetchUser(id)___blank_end___);
  return ___blank_start___Promise.all(promises)___blank_end___;
}

async function getUserNames(ids: number[]): Promise<string[]> {
  const users = await fetchAllUsers(ids);
  return users.map((user) => user.name);
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('fetches all users in parallel', async () => {
  const users = await fetchAllUsers([1, 2, 3])
  expect(users).toHaveLength(3)
  expect(users[0]).toEqual({ id: 1, name: 'User 1' })
  expect(users[2]).toEqual({ id: 3, name: 'User 3' })
})

test('returns user names', async () => {
  const names = await getUserNames([1, 2])
  expect(names).toEqual(['User 1', 'User 2'])
})

test('handles empty array', async () => {
  const users = await fetchAllUsers([])
  expect(users).toEqual([])
})
```
