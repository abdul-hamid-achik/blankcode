---
title: "Concurrency with Goroutines"
slug: "go-concurrency-with-goroutines"
description: "Learn Go's concurrency model with goroutines, channels, and synchronization primitives."
track: "go"
order: 3
difficulty: "advanced"
tags: ["goroutines", "channels", "concurrency", "context", "sync"]
---

# Concurrency with Goroutines

Concurrency is one of Go's defining features. While other languages bolt concurrency on through libraries, Go bakes it into the language with goroutines and channels. This makes concurrent programs easier to write, read, and reason about.

## Goroutines

A goroutine is a lightweight thread managed by the Go runtime. You start one with the `go` keyword before a function call.

```go
package main

import (
    "fmt"
    "time"
)

func printNumbers(label string) {
    for i := 1; i <= 5; i++ {
        fmt.Printf("%s: %d\n", label, i)
        time.Sleep(100 * time.Millisecond)
    }
}

func main() {
    go printNumbers("goroutine")
    printNumbers("main")
}
```

Goroutines are extremely cheap — you can run thousands or even millions of them. Each starts with a small stack (a few kilobytes) that grows and shrinks as needed. However, the program exits when `main` returns, regardless of whether other goroutines are still running. That is why we need synchronization.

> **Important:** Do NOT rely on `time.Sleep` for synchronization in real code. Use channels or sync primitives (like `WaitGroup`) instead. `time.Sleep` is used here only to illustrate interleaving — it provides no guarantee about goroutine completion.

## Channels

Channels are typed conduits that let goroutines communicate and synchronize. You send values into a channel and receive them on the other side.

```go
package main

import "fmt"

func sum(numbers []int, ch chan int) {
    total := 0
    for _, n := range numbers {
        total += n
    }
    ch <- total // send result to channel
}

func main() {
    numbers := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
    ch := make(chan int)

    // Split work across two goroutines
    mid := len(numbers) / 2
    go sum(numbers[:mid], ch)
    go sum(numbers[mid:], ch)

    // Receive both results
    a, b := <-ch, <-ch
    fmt.Println("Total:", a+b) // 55
}
```

Unbuffered channels block the sender until a receiver is ready, and vice versa. This blocking behavior is what makes channels useful for synchronization.

## Buffered Channels

Buffered channels hold a fixed number of values without a corresponding receiver. Sends block only when the buffer is full. Receives block only when the buffer is empty.

```go
package main

import "fmt"

func main() {
    ch := make(chan string, 3) // buffer size of 3

    ch <- "first"
    ch <- "second"
    ch <- "third"
    // ch <- "fourth" would block here (buffer full)

    fmt.Println(<-ch) // first
    fmt.Println(<-ch) // second
    fmt.Println(<-ch) // third
}
```

Use buffered channels when you know how many values will be sent, or when you want to decouple the speed of producers and consumers.

## The Select Statement

`select` lets a goroutine wait on multiple channel operations. It picks whichever case is ready first. If multiple are ready, it chooses one at random.

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    ch1 := make(chan string, 1)
    ch2 := make(chan string, 1)

    go func() {
        time.Sleep(200 * time.Millisecond)
        ch1 <- "result from service A"
    }()

    go func() {
        time.Sleep(100 * time.Millisecond)
        ch2 <- "result from service B"
    }()

    // Wait for the first response
    select {
    case msg := <-ch1:
        fmt.Println(msg)
    case msg := <-ch2:
        fmt.Println(msg) // prints first (faster)
    case <-time.After(1 * time.Second):
        fmt.Println("timeout")
    }
}
```

The channels are buffered with size 1 so the slower goroutine can complete its send and exit even after `select` has picked the faster result. With unbuffered channels, the goroutine that loses the `select` race would block on its send forever, causing a goroutine leak.

The `time.After` case acts as a timeout — if no channel is ready within the duration, the timeout fires. This pattern is essential for building resilient networked services.

## sync.WaitGroup

A `WaitGroup` waits for a collection of goroutines to finish. It is simpler than using channels when you do not need to pass data back.

```go
package main

import (
    "fmt"
    "sync"
)

func worker(id int, wg *sync.WaitGroup) {
    defer wg.Done()
    fmt.Printf("Worker %d starting\n", id)
    // simulate work
    fmt.Printf("Worker %d done\n", id)
}

func main() {
    var wg sync.WaitGroup

    for i := 1; i <= 5; i++ {
        wg.Add(1)
        go worker(i, &wg)
    }

    wg.Wait() // blocks until all workers call Done()
    fmt.Println("All workers finished")
}
```

Always call `wg.Add` before launching the goroutine, and always pass the `WaitGroup` by pointer. Calling `defer wg.Done()` at the start of the goroutine function ensures it runs even if the function returns early.

## sync.Mutex and sync.RWMutex

When multiple goroutines access shared data, you need a mutex to prevent race conditions. Use `sync.RWMutex` when reads are frequent and writes are rare — it allows multiple concurrent readers.

```go
package main

import (
    "fmt"
    "sync"
)

type SafeCounter struct {
    mu sync.RWMutex
    v  map[string]int
}

func (c *SafeCounter) Inc(key string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.v[key]++
}

func (c *SafeCounter) Value(key string) int {
    c.mu.RLock()
    defer c.mu.RUnlock()
    return c.v[key]
}

func main() {
    counter := SafeCounter{v: make(map[string]int)}

    var wg sync.WaitGroup
    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            counter.Inc("key")
        }()
    }

    wg.Wait()
    fmt.Println("Final count:", counter.Value("key")) // 1000
}
```

The `Value` method uses `RLock`/`RUnlock` because it only reads — multiple goroutines can hold a read lock simultaneously. The `Inc` method uses `Lock`/`Unlock` because it writes — it needs exclusive access. Always use `defer mu.Unlock()` right after locking to guarantee the lock is released.

## context.Context

The `context` package provides cancellation, timeouts, and deadline propagation across goroutines. It is essential for controlling the lifecycle of concurrent operations, especially in servers and pipelines.

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func fetchData(ctx context.Context, id int) (string, error) {
    select {
    case <-time.After(500 * time.Millisecond):
        return fmt.Sprintf("data-%d", id), nil
    case <-ctx.Done():
        return "", ctx.Err()
    }
}

func main() {
    // Create a context that cancels after 200ms
    ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
    defer cancel()

    result, err := fetchData(ctx, 42)
    if err != nil {
        fmt.Println("Failed:", err) // Failed: context deadline exceeded
        return
    }
    fmt.Println("Got:", result)
}
```

Always pass `context.Context` as the first parameter of functions that may block or perform I/O. Call `defer cancel()` immediately after creating a cancellable context to prevent resource leaks. Check `ctx.Done()` in select statements to respond promptly to cancellation.

## Concurrency Patterns

### Fan-Out, Fan-In

Fan-out means starting multiple goroutines to handle work from a single source. Fan-in means combining results from multiple goroutines into a single channel. Multiple goroutines reading from the same channel compete for values — each value goes to exactly one reader.

```go
package main

import (
    "fmt"
    "sync"
)

func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}

func square(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * n
        }
        close(out)
    }()
    return out
}

func merge(channels ...<-chan int) <-chan int {
    out := make(chan int)
    var wg sync.WaitGroup

    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan int) {
            defer wg.Done()
            for val := range c {
                out <- val
            }
        }(ch)
    }

    go func() {
        wg.Wait()
        close(out)
    }()

    return out
}

func main() {
    in := generate(1, 2, 3, 4, 5)

    // Fan out to two workers
    c1 := square(in)
    c2 := square(in)

    // Fan in the results
    for val := range merge(c1, c2) {
        fmt.Println(val)
    }
}
```

### Worker Pool

A worker pool limits the number of concurrent goroutines processing jobs from a shared channel.

```go
package main

import (
    "fmt"
    "sync"
)

func workerPool(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        result := job * 2
        fmt.Printf("Worker %d processed job %d -> %d\n", id, job, result)
        results <- result
    }
}

func main() {
    const numWorkers = 3
    const numJobs = 10

    jobs := make(chan int, numJobs)
    results := make(chan int, numJobs)

    var wg sync.WaitGroup
    for w := 1; w <= numWorkers; w++ {
        wg.Add(1)
        go workerPool(w, jobs, results, &wg)
    }

    for j := 1; j <= numJobs; j++ {
        jobs <- j
    }
    close(jobs)

    go func() {
        wg.Wait()
        close(results)
    }()

    total := 0
    for result := range results {
        total += result
    }
    fmt.Println("All jobs processed, total:", total)
}
```

Worker pools are the bread and butter of Go services. They control resource usage by limiting how many tasks run simultaneously.

## Practice

Head over to the [Go track](/tracks/go) to practice concurrency with interactive exercises. Start with simple goroutines and channels, then build up to patterns like fan-out/fan-in and worker pools.

## What's Next?

With concurrency under your belt, move on to [Error Handling Patterns](/tutorials/go-error-handling-patterns) to learn Go's distinctive approach to error management using values instead of exceptions.
