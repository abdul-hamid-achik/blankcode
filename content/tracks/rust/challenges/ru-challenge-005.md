---
slug: ru-challenge-005
title: 'Challenge: Build an Async Runtime'
description: Implement a minimal async runtime with task scheduling.
difficulty: expert
type: challenge
tags:
  - async
  - runtime
  - futures
---

# Challenge: Minimal Async Runtime

## Requirements

Create a minimal async runtime with the following features:

1. **Runtime struct** - Main runtime executor
2. **spawn(future) -> JoinHandle** - Spawn async task
3. **block_on(future)** - Run async code to completion
4. **yield_now()** - Yield execution to other tasks
5. **sleep(duration)** - Async sleep
6. **Channel mpsc** - Multi-producer single-consumer channel

## Constraints

- Use Pin and Future traits
- Implement Waker correctly
- Fair task scheduling (round-robin)
- Handle panics gracefully
- No external async runtime dependencies

## Example Usage

```rust
fn main() {
    let rt = Runtime::new();
    
    rt.block_on(async {
        let handle = rt.spawn(async {
            println!("Hello from task!");
            42
        });
        
        let result = handle.await;
        println!("Task returned: {:?}", result);
    });
}
```

Write your complete implementation below:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll, Waker};
use std::sync::{Arc, Mutex};

// Your implementation here
```

## Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn test_block_on_simple() {
        let rt = Runtime::new();
        
        let result = rt.block_on(async {
            42
        });
        
        assert_eq!(result, 42);
    }

    #[test]
    fn test_spawn_and_await() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let handle = rt.spawn(async {
                100
            });
            
            assert_eq!(handle.await, 100);
        });
    }

    #[test]
    fn test_spawn_multiple_tasks() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let mut handles = vec![];
            
            for i in 0..10 {
                let handle = rt.spawn(async move {
                    i * 2
                });
                handles.push(handle);
            }
            
            for (i, handle) in handles.into_iter().enumerate() {
                assert_eq!(handle.await, i * 2);
            }
        });
    }

    #[test]
    fn test_yield_now() {
        let rt = Runtime::new();
        let counter = Arc::new(AtomicUsize::new(0));
        
        let counter_clone = counter.clone();
        rt.block_on(async {
            let handle1 = rt.spawn(async move {
                counter_clone.fetch_add(1, Ordering::SeqCst);
                yield_now().await;
                counter_clone.fetch_add(1, Ordering::SeqCst);
            });
            
            let handle2 = rt.spawn(async move {
                counter_clone.fetch_add(1, Ordering::SeqCst);
            });
            
            handle1.await;
            handle2.await;
        });
        
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    #[test]
    fn test_sleep() {
        let rt = Runtime::new();
        
        let start = std::time::Instant::now();
        
        rt.block_on(async {
            sleep(std::time::Duration::from_millis(100)).await;
        });
        
        assert!(start.elapsed() >= std::time::Duration::from_millis(100));
    }

    #[test]
    fn test_channel_mpsc() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let (tx, mut rx) = mpsc::channel::<i32>(10);
            
            tx.send(1).await;
            tx.send(2).await;
            tx.send(3).await;
            
            drop(tx); // Close sender
            
            let mut received = vec![];
            while let Some(value) = rx.recv().await {
                received.push(value);
            }
            
            assert_eq!(received, vec![1, 2, 3]);
        });
    }

    #[test]
    fn test_channel_multiple_senders() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let (tx, mut rx) = mpsc::channel::<i32>(10);
            let tx2 = tx.clone();
            
            rt.spawn(async move {
                tx.send(1).await;
            });
            
            rt.spawn(async move {
                tx2.send(2).await;
            });
            
            let mut received = vec![];
            while let Some(value) = rx.recv().await {
                received.push(value);
            }
            
            assert_eq!(received.len(), 2);
        });
    }

    #[test]
    fn test_task_panic_handling() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let handle = rt.spawn(async {
                panic!("Task panicked!");
            });
            
            // Should not panic the whole runtime
            let result = handle.await;
            assert!(result.is_err());
        });
    }

    #[test]
    fn test_concurrent_counter() {
        let rt = Runtime::new();
        let counter = Arc::new(AtomicUsize::new(0));
        
        rt.block_on(async {
            let mut handles = vec![];
            
            for _ in 0..100 {
                let counter = Arc::clone(&counter);
                let handle = rt.spawn(async move {
                    counter.fetch_add(1, Ordering::SeqCst);
                });
                handles.push(handle);
            }
            
            for handle in handles {
                handle.await;
            }
        });
        
        assert_eq!(counter.load(Ordering::SeqCst), 100);
    }

    #[test]
    fn test_nested_spawn() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let outer = rt.spawn(async {
                let inner = rt.spawn(async {
                    42
                });
                inner.await
            });
            
            assert_eq!(outer.await, 42);
        });
    }

    #[test]
    fn test_async_iteration() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let mut sum = 0;
            for i in 0..10 {
                sum += i;
                yield_now().await;
            }
            assert_eq!(sum, 45);
        });
    }
}
```
