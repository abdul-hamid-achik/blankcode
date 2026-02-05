---
slug: rust-concurrency-and-async-basic-tasks
title: Spawning Your First Async Tasks
description: Learn how to create and run basic async tasks using tokio runtime in Rust
difficulty: beginner
hints:
  - Use tokio::spawn to create a new async task
  - The main function needs to be marked as async with the tokio runtime
  - Use .await to wait for async operations to complete
  - join! macro can run multiple futures concurrently
tags:
  - concurrency
  - async
  - tokio
  - tasks
---

In this exercise, you'll learn the basics of async programming in Rust using the Tokio runtime. You'll spawn async tasks and wait for them to complete.

Your task is to:
1. Mark the main function to use the tokio async runtime
2. Spawn an async task that prints a message
3. Use the join! macro to run multiple tasks concurrently
4. Await the completion of the spawned task

```typescript
import { describe, it, expect } from 'vitest';

const code = `
use tokio::time::{sleep, Duration};

___blank_start___#[tokio::main]___blank_end___
async fn main() {
    println!("Starting async program");
    
    // Spawn a new async task
    let task_handle = ___blank_start___tokio::spawn___blank_end___(async {
        sleep(Duration::from_millis(100)).await;
        println!("Task 1 completed");
        42
    });
    
    // Run multiple tasks concurrently using join!
    let (result1, result2) = ___blank_start___tokio::join!___blank_end___(
        async {
            sleep(Duration::from_millis(50)).await;
            "Task 2 done"
        },
        async {
            sleep(Duration::from_millis(50)).await;
            "Task 3 done"
        }
    );
    
    println!("Concurrent results: {}, {}", result1, result2);
    
    // Wait for the spawned task to complete
    let task_result = task_handle.___blank_start___await___blank_end___.unwrap();
    println!("Task result: {}", task_result);
}
`;

describe('Rust Async Basics Exercise', () => {
  it('should use #[tokio::main] attribute for async main', () => {
    expect(code).toMatch(/#\[tokio::main\]/);
  });

  it('should spawn an async task with tokio::spawn', () => {
    expect(code).toMatch(/tokio::spawn/);
  });

  it('should use tokio::join! macro for concurrent execution', () => {
    expect(code).toMatch(/tokio::join!/);
  });

  it('should await the task handle', () => {
    expect(code).toMatch(/task_handle\.await/);
  });

  it('should have all blanks filled correctly', () => {
    const blanks = code.match(/___blank_start___(.*?)___blank_end___/g);
    expect(blanks).toBeTruthy();
    expect(blanks?.length).toBe(4);
  });

  it('should use correct tokio imports', () => {
    expect(code).toContain('use tokio::time::{sleep, Duration}');
  });

  it('should handle task results properly', () => {
    expect(code).toMatch(/\.unwrap\(\)/);
    expect(code).toContain('task_result');
  });
});
```

## Tests

```rust
use tokio::time::{sleep, Duration};

#[tokio::test]
async fn async_tasks_complete() {
    let task_handle = tokio::spawn(async {
        sleep(Duration::from_millis(10)).await;
        42
    });

    let (result1, result2) = tokio::join!(
        async { "Task 2 done" },
        async { "Task 3 done" }
    );

    assert_eq!(result1, "Task 2 done");
    assert_eq!(result2, "Task 3 done");

    let task_result = task_handle.await.unwrap();
    assert_eq!(task_result, 42);
}
```
