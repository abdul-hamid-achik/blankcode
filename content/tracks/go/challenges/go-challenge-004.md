---
slug: go-challenge-004
title: 'Challenge: Build a Worker Pool'
description: Implement a worker pool pattern for concurrent job processing.
difficulty: expert
type: challenge
tags:
  - concurrency
  - goroutines
  - channels
---

# Challenge: Worker Pool

## Requirements

Create a `WorkerPool` type with the following features:

1. **NewWorkerPool(numWorkers int) *WorkerPool** - Create pool with N workers
2. **Start()** - Start all workers
3. **Submit(job Job)** - Submit job to be processed
4. **Stop()** - Gracefully shutdown all workers
5. **Stats() PoolStats** - Get pool statistics

Write your complete implementation below:

```go
package main

// Your implementation here
```

## Job Interface

```go
type Job interface {
    Execute() error
    ID() string
}
```

## Constraints

- Use goroutines for workers
- Use channels for job distribution
- Graceful shutdown (finish current jobs)
- Handle panics in jobs
- Track job success/failure counts

## Example Usage

```go
pool := NewWorkerPool(5)
pool.Start()

for i := 0; i < 100; i++ {
    pool.Submit(&MyJob{id: i})
}

pool.Stop()
fmt.Printf("Processed: %d, Failed: %d\n", 
    pool.Stats().SuccessCount, 
    pool.Stats().FailureCount)
```

## Tests

```go
package main

import (
    "errors"
    "sync/atomic"
    "testing"
    "time"
)

type testJob struct {
    id          int
    shouldFail  bool
    executed    *int32
}

func (j *testJob) Execute() error {
    atomic.AddInt32(j.executed, 1)
    if j.shouldFail {
        return errors.New("job failed")
    }
    return nil
}

func (j *testJob) ID() string {
    return string(rune(j.id))
}

func TestWorkerPoolBasic(t *testing.T) {
    var executed int32
    pool := NewWorkerPool(3)
    pool.Start()
    
    for i := 0; i < 10; i++ {
        pool.Submit(&testJob{id: i, executed: &executed})
    }
    
    pool.Stop()
    
    if executed != 10 {
        t.Errorf("Expected 10 jobs executed, got %d", executed)
    }
}

func TestWorkerPoolConcurrency(t *testing.T) {
    var executed int32
    pool := NewWorkerPool(5)
    pool.Start()
    
    for i := 0; i < 100; i++ {
        pool.Submit(&testJob{id: i, executed: &executed})
    }
    
    pool.Stop()
    
    if executed != 100 {
        t.Errorf("Expected 100 jobs executed, got %d", executed)
    }
}

func TestWorkerPoolHandlesFailures(t *testing.T) {
    var executed int32
    pool := NewWorkerPool(3)
    pool.Start()
    
    for i := 0; i < 10; i++ {
        pool.Submit(&testJob{
            id: i, 
            executed: &executed,
            shouldFail: i%2 == 0, // Fail half
        })
    }
    
    pool.Stop()
    
    stats := pool.Stats()
    if stats.SuccessCount+stats.FailureCount != 10 {
        t.Error("Not all jobs were counted")
    }
}

func TestWorkerPoolGracefulShutdown(t *testing.T) {
    var executed int32
    pool := NewWorkerPool(2)
    pool.Start()
    
    // Submit slow jobs
    for i := 0; i < 5; i++ {
        pool.Submit(&testJob{
            id: i, 
            executed: &executed,
        })
        time.Sleep(10 * time.Millisecond)
    }
    
    pool.Stop()
    
    // All jobs should complete before shutdown finishes
    if executed != 5 {
        t.Errorf("Expected 5 jobs executed, got %d", executed)
    }
}

func TestWorkerPoolStats(t *testing.T) {
    var executed int32
    pool := NewWorkerPool(3)
    pool.Start()
    
    for i := 0; i < 20; i++ {
        pool.Submit(&testJob{
            id: i, 
            executed: &executed,
            shouldFail: i < 5, // First 5 fail
        })
    }
    
    pool.Stop()
    
    stats := pool.Stats()
    if stats.FailureCount != 5 {
        t.Errorf("Expected 5 failures, got %d", stats.FailureCount)
    }
    if stats.SuccessCount != 15 {
        t.Errorf("Expected 15 successes, got %d", stats.SuccessCount)
    }
}

func TestWorkerPoolPanicRecovery(t *testing.T) {
    var executed int32
    pool := NewWorkerPool(2)
    pool.Start()
    
    panicJob := &panicJob{executed: &executed}
    normalJob := &testJob{id: 1, executed: &executed}
    
    pool.Submit(panicJob)
    pool.Submit(normalJob)
    
    pool.Stop()
    
    // Should not crash and should process normal job
    if executed < 1 {
        t.Error("Normal job should have executed after panic")
    }
}

type panicJob struct {
    executed *int32
}

func (j *panicJob) Execute() error {
    atomic.AddInt32(j.executed, 1)
    panic("panic in job")
}

func (j *panicJob) ID() string {
    return "panic"
}

func TestWorkerPoolZeroWorkers(t *testing.T) {
    defer func() {
        if r := recover(); r == nil {
            t.Error("Should panic with zero workers")
        }
    }()
    
    pool := NewWorkerPool(0)
    pool.Start()
}
```

## Solution

```go
package main

import (
	"sync"
)

type Job interface {
	Execute() error
	ID() string
}

type PoolStats struct {
	SuccessCount int
	FailureCount int
}

type WorkerPool struct {
	numWorkers int
	jobs       chan Job
	wg         sync.WaitGroup

	mu    sync.Mutex
	stats PoolStats

	stopOnce sync.Once
}

func NewWorkerPool(numWorkers int) *WorkerPool {
	return &WorkerPool{
		numWorkers: numWorkers,
		jobs:       make(chan Job),
	}
}

func (p *WorkerPool) Start() {
	// A pool with no workers would accept jobs and never run them, so Submit
	// would block forever. Failing loudly at Start is better than deadlocking.
	if p.numWorkers <= 0 {
		panic("worker pool needs at least one worker")
	}

	for i := 0; i < p.numWorkers; i++ {
		p.wg.Add(1)
		go p.worker()
	}
}

func (p *WorkerPool) worker() {
	defer p.wg.Done()
	for job := range p.jobs {
		p.run(job)
	}
}

// run isolates one job so a panic kills the job, not the worker. Without this
// the goroutine dies and the pool silently loses capacity.
func (p *WorkerPool) run(job Job) {
	failed := false
	defer func() {
		if r := recover(); r != nil {
			failed = true
		}
		p.mu.Lock()
		if failed {
			p.stats.FailureCount++
		} else {
			p.stats.SuccessCount++
		}
		p.mu.Unlock()
	}()

	if err := job.Execute(); err != nil {
		failed = true
	}
}

func (p *WorkerPool) Submit(job Job) {
	p.jobs <- job
}

// Stop closes the queue and waits. Closing before waiting is what makes the
// shutdown graceful: workers drain what is already queued, then their range
// loop ends.
func (p *WorkerPool) Stop() {
	p.stopOnce.Do(func() {
		close(p.jobs)
	})
	p.wg.Wait()
}

func (p *WorkerPool) Stats() PoolStats {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.stats
}
```
