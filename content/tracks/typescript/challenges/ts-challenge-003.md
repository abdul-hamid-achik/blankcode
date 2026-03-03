---
slug: ts-challenge-003
title: 'Challenge: Build a Promise Retry Utility'
description: Implement a utility that retries failed Promise operations with exponential backoff.
difficulty: advanced
type: challenge
tags:
  - promises
  - async
  - error-handling
---

# Challenge: Promise Retry Utility

## Requirements

Create a `retry` function with the following features:

1. **retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>** - Retries a failed promise
2. **RetryOptions interface** - Configuration for retry behavior
3. **maxRetries** - Maximum number of retry attempts (default: 3)
4. **delay** - Initial delay in ms (default: 1000)
5. **backoff** - Exponential backoff multiplier (default: 2)
6. **shouldRetry** - Optional predicate to determine if should retry

## Constraints

- Implement exponential backoff (delay * backoff^attempt)
- Only retry on rejected promises
- Return the result on first success
- Throw error after max retries exhausted
- Support custom retry condition

## Example Usage

```typescript
// Retry fetch with exponential backoff
const data = await retry(
  () => fetch('/api/data').then(r => r.json()),
  { maxRetries: 5, delay: 1000, backoff: 2 }
)

// Only retry on network errors
const result = await retry(
  () => apiCall(),
  { 
    maxRetries: 3,
    shouldRetry: (error) => error.code === 'NETWORK_ERROR'
  }
)
```

Write your complete implementation below:

```typescript
// Your implementation here
```

## Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { retry, RetryOptions } from './retry'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('retry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const promise = retry(fn)
    
    const result = await promise
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValueOnce('success')
    
    const promise = retry(fn, { maxRetries: 3, delay: 100 })
    
    vi.advanceTimersByTime(200)
    const result = await promise
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'))
    
    const promise = retry(fn, { maxRetries: 3, delay: 100 })
    
    vi.advanceTimersByTime(300)
    
    await expect(promise).rejects.toThrow('Always fails')
    expect(fn).toHaveBeenCalledTimes(4) // Initial + 3 retries
  })

  it('should use exponential backoff', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fail'))
    
    retry(fn, { maxRetries: 3, delay: 100, backoff: 2 })
    
    // First retry after 100ms
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)
    
    // Second retry after 200ms (100 * 2)
    await vi.advanceTimersByTimeAsync(200)
    expect(fn).toHaveBeenCalledTimes(3)
    
    // Third retry after 400ms (100 * 2^2)
    await vi.advanceTimersByTimeAsync(400)
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('should respect shouldRetry predicate', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Retry me'))
      .mockRejectedValueOnce(new Error('Dont retry'))
    
    const promise = retry(fn, {
      maxRetries: 3,
      delay: 100,
      shouldRetry: (error: Error) => error.message === 'Retry me'
    })
    
    vi.advanceTimersByTime(100)
    
    await expect(promise).rejects.toThrow('Dont retry')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should pass attempt number to shouldRetry', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fail'))
    const shouldRetry = vi.fn().mockReturnValue(true)
    
    retry(fn, { maxRetries: 3, delay: 100, shouldRetry })
    
    await vi.advanceTimersByTimeAsync(700)
    
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1)
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 2)
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 3)
  })

  it('should handle custom backoff multiplier', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fail'))
    
    retry(fn, { maxRetries: 2, delay: 100, backoff: 3 })
    
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)
    
    await vi.advanceTimersByTimeAsync(300) // 100 * 3
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
```
