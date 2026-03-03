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

Write your complete implementation below:

```go
package main

// Your implementation here
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
