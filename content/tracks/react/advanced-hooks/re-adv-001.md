---
slug: react-advancedhooks-custom-counter-hook
title: Build Your First Custom Hook
description: Create a custom hook that manages counter state with increment, decrement, and reset functionality to understand the basics of custom React hooks.
difficulty: beginner
hints:
  - Custom hooks must start with "use" prefix
  - Custom hooks can use other hooks like useState inside them
  - Return an object or array with the state and functions you want to expose
  - Remember that hooks can only be called at the top level of a function
tags:
  - react
  - hooks
  - custom-hooks
  - useState
---

Create a custom hook called `useCounter` that encapsulates counter logic. This hook should:
- Accept an initial value (defaulting to 0)
- Return the current count
- Provide increment, decrement, and reset functions

Custom hooks are a powerful way to reuse stateful logic across components. They follow the same rules as regular hooks and can call other hooks internally.

```typescript
import { useState } from 'react';

interface UseCounterReturn {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

function ___blank_start___useCounter___blank_end___(initialValue: number = 0): UseCounterReturn {
  const [count, setCount] = ___blank_start___useState(initialValue)___blank_end___;

  const increment = () => {
    ___blank_start___setCount(count + 1)___blank_end___;
  };

  const decrement = () => {
    setCount(count - 1);
  };

  const reset = () => {
    ___blank_start___setCount(initialValue)___blank_end___;
  };

  return {
    count,
    increment,
    decrement,
    reset,
  };
}

export default useCounter;
```

## Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import useCounter from './useCounter';

describe('useCounter', () => {
  it('should initialize with default value of 0', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('should initialize with provided initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    expect(result.current.count).toBe(10);
  });

  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter(5));
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(6);
  });

  it('should decrement counter', () => {
    const { result } = renderHook(() => useCounter(5));
    
    act(() => {
      result.current.decrement();
    });
    
    expect(result.current.count).toBe(4);
  });

  it('should reset counter to initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    
    act(() => {
      result.current.increment();
      result.current.increment();
    });
    
    expect(result.current.count).toBe(12);
    
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.count).toBe(10);
  });

  it('should handle multiple operations correctly', () => {
    const { result } = renderHook(() => useCounter(0));
    
    act(() => {
      result.current.increment();
      result.current.increment();
      result.current.decrement();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```