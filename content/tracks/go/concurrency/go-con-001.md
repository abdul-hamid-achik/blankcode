---
slug: go-concurrency-goroutines-basics
title: Introduction to Goroutines
description: Learn how to create and use goroutines to run functions concurrently in Go
difficulty: intermediate
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

import (
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

// captureOutput runs fn with stdout captured. It never blocks the test
// indefinitely: if fn (main) doesn't finish in time — e.g. because a
// goroutine never calls wg.Done() and wg.Wait() blocks forever — it fails
// the test instead of hanging or triggering a Go runtime deadlock crash.
func captureOutput(t *testing.T, fn func()) (string, time.Duration) {
	t.Helper()

	original := os.Stdout
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("failed to create pipe: %v", err)
	}
	os.Stdout = writer

	done := make(chan struct{})
	start := time.Now()
	go func() {
		fn()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		os.Stdout = original
		_ = writer.Close()
		t.Fatal("main() did not finish within 2s — check that every goroutine calls wg.Done()")
		return "", 0
	}
	elapsed := time.Since(start)

	_ = writer.Close()
	os.Stdout = original
	output, _ := io.ReadAll(reader)
	return string(output), elapsed
}

func TestAllGoroutinesCompleteBeforeExit(t *testing.T) {
	output, _ := captureOutput(t, main)
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) != 4 {
		t.Fatalf("expected 4 lines of output (3 messages + completion), got %d: %q", len(lines), output)
	}
	if lines[len(lines)-1] != "All goroutines completed!" {
		t.Fatalf("expected the completion message to print last (after wg.Wait()), got %q", lines[len(lines)-1])
	}
	for i := 1; i <= 3; i++ {
		want := fmt.Sprintf("Message from goroutine %d", i)
		if !strings.Contains(output, want) {
			t.Fatalf("expected output to contain %q, got %q", want, output)
		}
	}
}

func TestGoroutinesRunConcurrently(t *testing.T) {
	_, elapsed := captureOutput(t, main)
	if elapsed >= 250*time.Millisecond {
		t.Fatalf("main() took %v to finish — the 3 goroutines should run concurrently (~100ms total), not sequentially (~300ms); check the 'go' keyword", elapsed)
	}
}
```
