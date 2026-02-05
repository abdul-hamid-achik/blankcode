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

```go
package main

import "testing"

func TestProgramRuns(t *testing.T) {
	main()
}
```
