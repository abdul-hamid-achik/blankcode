---
slug: ts-async-001
title: Basic Promise Creation
description: Create a Promise that resolves with a greeting message after a delay.
difficulty: beginner
hints:
  - Use the Promise constructor
  - setTimeout can be used for delays
  - resolve() is called with the result value
tags:
  - promises
  - async
  - basics
---

Complete the function to return a Promise that resolves with a greeting after the specified delay.

```typescript
function delayedGreeting(name: string, delayMs: number): Promise<string> {
  return new ___blank_start___Promise___blank_end___((resolve) => {
    ___blank_start___setTimeout___blank_end___(() => {
      resolve(___blank_start___`Hello, ${name}!`___blank_end___);
    }, delayMs);
  });
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('resolves with greeting after delay', async () => {
  const start = Date.now()
  const result = await delayedGreeting('World', 100)
  const elapsed = Date.now() - start

  expect(result).toBe('Hello, World!')
  expect(elapsed).toBeGreaterThanOrEqual(100)
})

test('works with different names', async () => {
  const result = await delayedGreeting('TypeScript', 50)
  expect(result).toBe('Hello, TypeScript!')
})
```
