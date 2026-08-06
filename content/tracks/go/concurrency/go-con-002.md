---
slug: go-concurrency-goroutines-basic
title: Your First Goroutines
description: Learn how to launch goroutines and wait for them to complete using WaitGroups
difficulty: intermediate
hints:
  - Goroutines are launched using the 'go' keyword before a function call
  - WaitGroups need to know how many goroutines to wait for using Add()
  - Each goroutine should call Done() when it finishes
  - The main function should call Wait() to block until all goroutines complete
tags:
  - concurrency
  - goroutines
  - waitgroup
---

In Go, goroutines are lightweight threads managed by the Go runtime. To ensure your program waits for all goroutines to finish, you'll use `sync.WaitGroup`.

Your task is to complete the code below to:
1. Launch a goroutine that prints a message
2. Properly configure the WaitGroup to track the goroutine
3. Ensure the main function waits for the goroutine to complete

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

func printMessage(msg string, wg *sync.WaitGroup) {
	// Signal that this goroutine is done when function completes
	___blank_start___defer wg.Done()___blank_end___
	
	time.Sleep(100 * time.Millisecond)
	fmt.Println(msg)
}

func main() {
	var wg sync.WaitGroup
	
	// Tell the WaitGroup we're adding 1 goroutine to track
	___blank_start___wg.Add(1)___blank_end___
	
	// Launch the goroutine
	___blank_start___go___blank_end___ printMessage("Hello from goroutine!", &wg)
	
	// Wait for all goroutines to complete
	___blank_start___wg.Wait()___blank_end___
	
	fmt.Println("All goroutines completed!")
}
```

## Tests

```go
package main

import (
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

// captureOutput runs fn with stdout captured. fn runs in its own goroutine
// with a bounded wait so that a WaitGroup which never reaches zero — e.g.
// because a goroutine never calls wg.Done() — fails the test cleanly instead
// of hanging or triggering a Go runtime deadlock crash.
func captureOutput(t *testing.T, fn func()) string {
	t.Helper()
	original := os.Stdout
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("failed to create pipe: %v", err)
	}
	os.Stdout = writer

	done := make(chan struct{})
	go func() {
		fn()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		os.Stdout = original
		_ = writer.Close()
		t.Fatal("main() did not finish within 2s — check that the goroutine calls wg.Done()")
		return ""
	}

	_ = writer.Close()
	os.Stdout = original
	output, _ := io.ReadAll(reader)
	return string(output)
}

func TestProgramOutput(t *testing.T) {
	output := captureOutput(t, main)
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 output lines, got %d", len(lines))
	}
	if lines[0] != "Hello from goroutine!" {
		t.Fatalf("expected first line to be goroutine message, got %q", lines[0])
	}
	if lines[1] != "All goroutines completed!" {
		t.Fatalf("expected final line to be completion message, got %q", lines[1])
	}
}
```
