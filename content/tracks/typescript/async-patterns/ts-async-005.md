---
slug: ts-async-005
title: Retry Logic with Async
description: Implement retry logic for failed async operations.
difficulty: advanced
hints:
  - Use a loop to retry the operation
  - Track the number of attempts
  - Throw the error after max retries are exhausted
  - Consider adding a delay between retries
tags:
  - async
  - retry
  - error-handling
  - advanced
---

Implement a retry wrapper for unreliable async operations.

```typescript
interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= ___blank_start___options.maxAttempts___blank_end___; attempt++) {
    try {
      return ___blank_start___await fn()___blank_end___;
    } catch (error) {
      lastError = error as Error;
      if (attempt < options.maxAttempts) {
        ___blank_start___await sleep(options.delayMs)___blank_end___;
      }
    }
  }

  ___blank_start___throw lastError___blank_end___;
}
```

## Tests

```typescript
import { expect, test, vi } from 'vitest'

test('returns result on first success', async () => {
  const fn = vi.fn().mockResolvedValue('success')
  const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 })
  expect(result).toBe('success')
  expect(fn).toHaveBeenCalledTimes(1)
})

test('retries on failure and succeeds', async () => {
  const fn = vi.fn()
    .mockRejectedValueOnce(new Error('fail'))
    .mockRejectedValueOnce(new Error('fail'))
    .mockResolvedValue('success')

  const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 })
  expect(result).toBe('success')
  expect(fn).toHaveBeenCalledTimes(3)
})

test('throws after max attempts', async () => {
  const fn = vi.fn().mockRejectedValue(new Error('always fails'))

  await expect(
    withRetry(fn, { maxAttempts: 2, delayMs: 10 })
  ).rejects.toThrow('always fails')
  expect(fn).toHaveBeenCalledTimes(2)
})
```
