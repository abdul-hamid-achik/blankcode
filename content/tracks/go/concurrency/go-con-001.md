---
slug: go-concurrency-goroutines-basics
title: Introduction to Goroutines
description: Learn how to create and use goroutines to run functions concurrently in Go
difficulty: beginner
hints:
  - Use the 'go' keyword before a function call to run it as a goroutine
  - Goroutines run concurrently with the main function
  - Use WaitGroups to wait for goroutines to complete before exiting
  - Don't forget to call Done() when a goroutine finishes its work
tags:
  - concurrency
  - goroutines
  - waitgroup
  - go
---

# Introduction to Goroutines

In this exercise, you'll learn the basics of goroutines - Go's lightweight threads that enable concurrent execution.

Your task is to complete a program that prints messages from multiple goroutines. The program should:
1. Launch 3 goroutines that each print a message
2. Wait for all goroutines to complete before the program exits
3. Use a `sync.WaitGroup` to coordinate the goroutines

Fill in the blanks to make the concurrent program work correctly.

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

func printMessage(id int, wg *sync.WaitGroup) {
	// Signal that this goroutine is done when the function completes
	___blank_start___defer wg.Done()___blank_end___
	
	time.Sleep(100 * time.Millisecond)
	fmt.Printf("Message from goroutine %d\n", id)
}

func main() {
	var wg sync.WaitGroup
	
	// Launch 3 goroutines
	for i := 1; i <= 3; i++ {
		// Tell the WaitGroup we're adding one goroutine
		___blank_start___wg.Add(1)___blank_end___
		
		// Launch the goroutine
		___blank_start___go___blank_end___ printMessage(i, &wg)
	}
	
	// Wait for all goroutines to complete
	___blank_start___wg.Wait()___blank_end___
	
	fmt.Println("All goroutines completed!")
}
```

## Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('Go Goroutines Basics', () => {
  it('should use defer wg.Done() to signal completion', () => {
    const code = `{{ code }}`;
    expect(code).toMatch(/defer\s+wg\.Done\(\)/);
  });

  it('should call wg.Add(1) before launching goroutines', () => {
    const code = `{{ code }}`;
    expect(code).toMatch(/wg\.Add\s*\(\s*1\s*\)/);
  });

  it('should use the go keyword to launch goroutines', () => {
    const code = `{{ code }}`;
    expect(code).toMatch(/go\s+printMessage/);
  });

  it('should call wg.Wait() to wait for goroutines', () => {
    const code = `{{ code }}`;
    expect(code).toMatch(/wg\.Wait\s*\(\s*\)/);
  });

  it('should have correct order: Add before go, Wait after loop', () => {
    const code = `{{ code }}`;
    const addIndex = code.indexOf('wg.Add');
    const goIndex = code.indexOf('go printMessage');
    const waitIndex = code.indexOf('wg.Wait');
    
    expect(addIndex).toBeLessThan(goIndex);
    expect(goIndex).toBeLessThan(waitIndex);
  });

  it('should pass WaitGroup by pointer', () => {
    const code = `{{ code }}`;
    expect(code).toMatch(/printMessage\s*\(\s*i\s*,\s*&wg\s*\)/);
  });

  it('should use defer to ensure Done is called', () => {
    const code = `{{ code }}`;
    const deferMatch = code.match(/defer\s+wg\.Done\(\)/);
    expect(deferMatch).toBeTruthy();
  });
});
```