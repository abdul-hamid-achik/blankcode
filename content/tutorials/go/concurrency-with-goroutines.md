---
title: "Concurrency with Goroutines"
slug: "go-concurrency-with-goroutines"
description: "Goroutines, channels, and select as Go's concurrency primitives — when to reach for a WaitGroup versus a channel, and the loop-variable rule that changed in Go 1.22."
track: "go"
order: 3
difficulty: "advanced"
tags: ["goroutines", "channels", "concurrency", "context", "sync"]
practice:
  concept: "concurrency"
  label: "Concurrency"
---

Other languages bolt concurrency on as a library. Go bakes it into the language: `go` starts a goroutine, channels move data between them, and `select` waits on several at once. The primitives are small. Using them correctly is a different skill from knowing their syntax, and that is what this tutorial is actually about.

## Goroutines are cheap, not disposable

`go f()` starts a goroutine — a function running concurrently, scheduled by the Go runtime rather than the OS. Each one starts with a stack of a few kilobytes that grows as needed, so running thousands is routine and running hundreds of thousands is still fine.

```go
func printNumbers(label string) {
	for i := 1; i <= 3; i++ {
		fmt.Printf("%s: %d\n", label, i)
	}
}

func main() {
	go printNumbers("background")
	printNumbers("main")
	// main can return before "background" finishes printing —
	// the program exits the instant main() returns, goroutines or not.
}
```

`main` returning ends the program regardless of what other goroutines are doing; there is no implicit wait. Never use `time.Sleep` to paper over that — it is a race with a delay attached, not a guarantee. Channels and `sync.WaitGroup`, below, are the real synchronization tools.

## Channels: typed, blocking communication

A channel is a typed pipe between goroutines. An unbuffered channel blocks the sender until a receiver is ready, and blocks the receiver until a sender shows up — that blocking is the synchronization.

```go
func sum(nums []int, ch chan int) {
	total := 0
	for _, n := range nums {
		total += n
	}
	ch <- total
}

func main() {
	nums := []int{1, 2, 3, 4, 5, 6}
	ch := make(chan int)

	go sum(nums[:3], ch)
	go sum(nums[3:], ch)

	a, b := <-ch, <-ch
	fmt.Println(a + b) // 21
}
```

::code-blank{lang="go" href="/tracks/go/concurrency" label="practice concurrency for real"}
---
code: |
  ch := make(___blank_start___chan___blank_end___ int)
---
::

## Buffered channels, select, and timeouts

A buffered channel holds values without a receiver present — sends block only once the buffer is full. `select` waits on several channel operations and runs whichever is ready first; if several are ready at once, it picks one at random.

```go
ch1 := make(chan string, 1)
ch2 := make(chan string, 1)

go func() { ch1 <- "from A" }()
go func() { ch2 <- "from B" }()

select {
case msg := <-ch1:
	fmt.Println(msg)
case msg := <-ch2:
	fmt.Println(msg)
case <-time.After(time.Second):
	fmt.Println("timeout")
}
```

The buffer of size 1 matters here: whichever goroutine loses the `select` still has somewhere to put its value, so it can finish and exit. With unbuffered channels the losing goroutine would block on its send forever — a goroutine leak with no error and no crash, just a process that slowly accumulates stuck goroutines. `time.After` gives you the timeout case for free; a `select` with no ready case and no timeout blocks indefinitely, so production code almost always has one.

::code-blank{lang="go" href="/tracks/go/concurrency" label="practice concurrency for real"}
---
code: |
  ___blank_start___select___blank_end___ {
  case msg := <-ch1:
      fmt.Println(msg)
  case <-time.After(time.Second):
      fmt.Println("timeout")
  }
---
::

## sync.WaitGroup and sync.Mutex

A `WaitGroup` counts outstanding goroutines and blocks until the count returns to zero — simpler than a channel when you don't need to pass data back. A `Mutex` protects shared state that multiple goroutines touch.

```go
type Counter struct {
	mu sync.Mutex
	n  int
}

func (c *Counter) Inc() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.n++
}

func main() {
	var wg sync.WaitGroup
	c := &Counter{}

	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c.Inc()
		}()
	}
	wg.Wait()
	fmt.Println(c.n) // 1000
}
```

Call `wg.Add` before starting the goroutine, never from inside it — otherwise `Wait` can race past a count that has not been incremented yet. Run anything touching shared state under `go run -race` at least once during development; the race detector catches exactly this class of bug, reliably, not "usually."

::code-blank{lang="go" href="/tracks/go/concurrency" label="practice concurrency for real"}
---
code: |
  c.mu.Lock()
  ___blank_start___defer___blank_end___ c.mu.Unlock()
---
::

## context.Context for cancellation

`context.Context` propagates cancellation, timeouts, and deadlines across goroutines. Pass it as the first parameter of any function that might block or do I/O.

```go
func fetch(ctx context.Context, id int) (string, error) {
	select {
	case <-time.After(500 * time.Millisecond):
		return fmt.Sprintf("data-%d", id), nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
defer cancel()

if _, err := fetch(ctx, 42); err != nil {
	fmt.Println(err) // context deadline exceeded
}
```

Call the returned `cancel` immediately after creating the context, even though the timeout will fire on its own — deferring it right away is the pattern, and skipping it leaks the internal timer until the deadline arrives regardless of whether you still need the result.

## The loop variable Go 1.22 fixed

Before Go 1.22, a `for` loop reused one variable across every iteration. A goroutine closing over that variable captured the variable itself, not the value at the moment `go` was called — and by the time the goroutine ran, the loop had usually moved on.

```go
for _, id := range []int{1, 2, 3} {
	go func() {
		fmt.Println(id) // pre-1.22: usually prints 3, 3, 3
	}()
}
```

Go 1.22 changed the language semantics: every iteration now gets its own copy of the loop variable, so this same code reliably prints `1`, `2`, `3` in some order on current Go. The old workaround still shows up in codebases written before the change, and it is harmless to leave in place:

```go
for _, id := range []int{1, 2, 3} {
	id := id // pre-1.22 idiom — shadow to get a fresh variable per iteration
	go func() {
		fmt.Println(id)
	}()
}
```

What decides which behavior you get is not your Go toolchain version but the `go` line in that module's `go.mod`. A module that declares `go 1.21` or earlier keeps the old capture semantics even when compiled with a current toolchain — this is a per-module language version, not a global one, so it's worth checking before assuming.

## Where this bites

**`main` does not wait for goroutines it did not join.** The program exits the moment `main` returns, mid-flight goroutines and all. Block on a `WaitGroup` or a channel receive for anything that has to finish first.

**A goroutine that loses a `select` on an unbuffered channel blocks forever.** No error, no crash — it just sits there, and the count of stuck goroutines grows every time the pattern repeats. Size the channel for the sends that might lose the race, or give the sender its own `select` with a way out.

**Per-iteration loop variables are not guaranteed just because you're on a recent toolchain.** The semantics are gated by the `go` directive in `go.mod`, not the compiler you happen to be running. A vendored or older module can still exhibit pre-1.22 capture even in a build done today.

**Holding a mutex across a blocking call stalls every other goroutine waiting on it.** A channel receive or a network call done while a lock is held turns one slow operation into a queue. Keep the locked section to the minimum touching shared state, and do I/O before or after, never during.
