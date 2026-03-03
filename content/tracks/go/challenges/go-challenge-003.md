---
slug: go-challenge-003
title: 'Challenge: Build a Rate Limiter'
description: Implement a token bucket rate limiter with concurrent access support.
difficulty: advanced
type: challenge
tags:
  - concurrency
  - algorithms
  - production-ready
---

# Challenge: Rate Limiter

## Requirements

Create a `RateLimiter` type with the following features:

1. **NewRateLimiter(rate int, capacity int) *RateLimiter** - Create limiter with tokens/second and bucket size
2. **Allow() bool** - Check if request is allowed (consumes token)
3. **AllowN(n int) bool** - Check if N requests are allowed
4. **Wait()** - Block until token available
5. **Remaining() int** - Get remaining tokens
6. **Reset()** - Reset to full capacity

## Constraints

- Thread-safe for concurrent access
- Token bucket algorithm implementation
- Refill tokens based on elapsed time
- Don't exceed capacity
- Use time.Ticker for token refill

## Example Usage

```go
limiter := NewRateLimiter(10, 20) // 10 req/sec, max 20 tokens

for i := 0; i < 100; i++ {
    if limiter.Allow() {
        makeRequest()
    } else {
        // Rate limited
    }
}
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
    "time"
)

func TestRateLimiterAllow(t *testing.T) {
    limiter := NewRateLimiter(10, 5)
    
    // Should allow up to capacity
    for i := 0; i < 5; i++ {
        if !limiter.Allow() {
            t.Errorf("Expected Allow() to return true for request %d", i)
        }
    }
    
    // Should deny after capacity exhausted
    if limiter.Allow() {
        t.Error("Expected Allow() to return false after capacity exhausted")
    }
}

func TestRateLimiterAllowN(t *testing.T) {
    limiter := NewRateLimiter(10, 10)
    
    if !limiter.AllowN(5) {
        t.Error("Expected AllowN(5) to return true")
    }
    
    if !limiter.AllowN(5) {
        t.Error("Expected AllowN(5) to return true")
    }
    
    if limiter.AllowN(1) {
        t.Error("Expected AllowN(1) to return false")
    }
}

func TestRateLimiterRemaining(t *testing.T) {
    limiter := NewRateLimiter(10, 10)
    
    if limiter.Remaining() != 10 {
        t.Errorf("Expected 10 remaining, got %d", limiter.Remaining())
    }
    
    limiter.Allow()
    limiter.Allow()
    limiter.Allow()
    
    if limiter.Remaining() != 7 {
        t.Errorf("Expected 7 remaining, got %d", limiter.Remaining())
    }
}

func TestRateLimiterReset(t *testing.T) {
    limiter := NewRateLimiter(10, 10)
    
    for i := 0; i < 10; i++ {
        limiter.Allow()
    }
    
    limiter.Reset()
    
    if limiter.Remaining() != 10 {
        t.Errorf("Expected 10 remaining after reset, got %d", limiter.Remaining())
    }
}

func TestRateLimiterConcurrent(t *testing.T) {
    limiter := NewRateLimiter(100, 50)
    var wg sync.WaitGroup
    allowed := make(chan bool, 100)
    
    wg.Add(100)
    for i := 0; i < 100; i++ {
        go func() {
            defer wg.Done()
            allowed <- limiter.Allow()
        }()
    }
    
    wg.Wait()
    close(allowed)
    
    allowedCount := 0
    for result := range allowed {
        if result {
            allowedCount++
        }
    }
    
    if allowedCount > 50 {
        t.Errorf("Expected at most 50 allowed, got %d", allowedCount)
    }
}

func TestRateLimiterTokenRefill(t *testing.T) {
    limiter := NewRateLimiter(10, 5)
    
    // Exhaust all tokens
    for i := 0; i < 5; i++ {
        limiter.Allow()
    }
    
    // Wait for token refill (100ms at 10/sec = 1 token)
    time.Sleep(150 * time.Millisecond)
    
    if !limiter.Allow() {
        t.Error("Expected Allow() to return true after token refill")
    }
}

func TestRateLimiterDoesNotExceedCapacity(t *testing.T) {
    limiter := NewRateLimiter(100, 5)
    
    // Wait for potential over-fill
    time.Sleep(200 * time.Millisecond)
    
    // Should still be at capacity
    count := 0
    for limiter.Allow() {
        count++
    }
    
    if count != 5 {
        t.Errorf("Expected 5 tokens (capacity), got %d", count)
    }
}
```
