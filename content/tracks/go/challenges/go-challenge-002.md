---
slug: go-challenge-002
title: 'Challenge: Build a Thread-Safe Counter'
description: Implement a concurrent-safe counter using Go's synchronization primitives.
difficulty: intermediate
type: challenge
tags:
  - concurrency
  - mutex
  - goroutines
---

# Challenge: Thread-Safe Counter

## Requirements

Create a `Counter` type that is safe for concurrent use:

1. **NewCounter(initial int) *Counter** - Creates a new counter with initial value
2. **Increment() int** - Increments by 1 and returns new value (thread-safe)
3. **Decrement() int** - Decrements by 1 and returns new value (thread-safe)
4. **Add(n int) int** - Adds n and returns new value (thread-safe)
5. **Value() int** - Returns current value (thread-safe)
6. **Reset()** - Resets to 0 (thread-safe)

## Constraints

- Must use `sync.Mutex` or `sync/atomic` for thread safety
- All operations must be atomic
- Support negative values
- Must handle concurrent access from multiple goroutines

## Example Usage

```go
counter := NewCounter(0)
counter.Increment()  // Returns 1
counter.Add(10)      // Returns 11
counter.Value()      // Returns 11
```

Write your complete implementation below:

```go
package main

// Your implementation here
```

## Tests

```go
package main

import (
    "sync"
    "testing"
)

func TestCounterBasic(t *testing.T) {
    c := NewCounter(0)
    
    if v := c.Value(); v != 0 {
        t.Errorf("Expected 0, got %d", v)
    }
    
    if v := c.Increment(); v != 1 {
        t.Errorf("Expected 1, got %d", v)
    }
    
    if v := c.Decrement(); v != 0 {
        t.Errorf("Expected 0, got %d", v)
    }
    
    if v := c.Add(10); v != 10 {
        t.Errorf("Expected 10, got %d", v)
    }
    
    c.Reset()
    if v := c.Value(); v != 0 {
        t.Errorf("Expected 0 after reset, got %d", v)
    }
}

func TestCounterInitialValue(t *testing.T) {
    c := NewCounter(100)
    if v := c.Value(); v != 100 {
        t.Errorf("Expected 100, got %d", v)
    }
}

func TestCounterNegative(t *testing.T) {
    c := NewCounter(0)
    c.Decrement()
    if v := c.Value(); v != -1 {
        t.Errorf("Expected -1, got %d", v)
    }
}

func TestCounterConcurrent(t *testing.T) {
    c := NewCounter(0)
    var wg sync.WaitGroup
    iterations := 1000
    goroutines := 10
    
    wg.Add(goroutines)
    for i := 0; i < goroutines; i++ {
        go func() {
            defer wg.Done()
            for j := 0; j < iterations; j++ {
                c.Increment()
            }
        }()
    }
    
    wg.Wait()
    
    expected := goroutines * iterations
    if v := c.Value(); v != expected {
        t.Errorf("Expected %d, got %d", expected, v)
    }
}

func TestCounterConcurrentMixed(t *testing.T) {
    c := NewCounter(100)
    var wg sync.WaitGroup
    iterations := 500
    
    wg.Add(2)
    go func() {
        defer wg.Done()
        for i := 0; i < iterations; i++ {
            c.Increment()
        }
    }()
    
    go func() {
        defer wg.Done()
        for i := 0; i < iterations; i++ {
            c.Decrement()
        }
    }()
    
    wg.Wait()
    
    if v := c.Value(); v != 100 {
        t.Errorf("Expected 100, got %d", v)
    }
}
```
