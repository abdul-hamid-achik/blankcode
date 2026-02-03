---
slug: ts-async-003
title: Error Handling with Async/Await
description: Properly handle errors in async functions using try/catch.
difficulty: intermediate
hints:
  - Wrap async operations in try/catch blocks
  - The catch block receives the error object
  - You can re-throw errors or return default values
tags:
  - async
  - error-handling
  - try-catch
---

Add error handling to this async function that fetches data.

```typescript
interface ApiResponse<T> {
  data: T;
  error?: string;
}

async function fetchData(url: string): Promise<string> {
  if (url.includes('error')) {
    throw new Error('Network error');
  }
  return `Data from ${url}`;
}

async function safeFetch(url: string): Promise<ApiResponse<string>> {
  ___blank_start___try___blank_end___ {
    const data = await fetchData(url);
    return { ___blank_start___data___blank_end___ };
  } ___blank_start___catch (error)___blank_end___ {
    return {
      data: '',
      error: ___blank_start___(error as Error).message___blank_end___
    };
  }
}
```

## Tests

```typescript
import { expect, test } from 'vitest'

test('returns data on success', async () => {
  const result = await safeFetch('https://api.example.com')
  expect(result.data).toBe('Data from https://api.example.com')
  expect(result.error).toBeUndefined()
})

test('returns error on failure', async () => {
  const result = await safeFetch('https://error.example.com')
  expect(result.data).toBe('')
  expect(result.error).toBe('Network error')
})
```
