---
title: "Fearless Concurrency"
slug: "rust-fearless-concurrency"
description: "Write safe concurrent Rust programs with threads, channels, shared state, and async/await."
track: "rust"
order: 4
difficulty: "advanced"
tags: ["concurrency", "threads", "async", "mutex", "arc", "tokio"]
---

# Fearless Concurrency

Concurrent programming is notoriously difficult. Data races, deadlocks, and subtle bugs plague programs in most languages. Rust's ownership system and type checker eliminate entire categories of concurrency bugs at compile time, which is why the Rust community calls it "fearless concurrency."

**Important caveat:** Rust prevents **data races** at compile time, but it does **not** prevent **deadlocks**. A deadlock occurs when two or more threads each wait for a lock held by the other. The compiler cannot detect this, so you must design your locking strategy carefully (e.g., always acquire locks in the same order).

## Spawning Threads

The standard library provides OS threads via `std::thread::spawn`. Each spawned thread gets its own stack and runs independently.

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        for i in 1..=5 {
            println!("  spawned thread: count {}", i);
            thread::sleep(Duration::from_millis(100));
        }
        42 // threads can return a value
    });

    for i in 1..=3 {
        println!("main thread: count {}", i);
        thread::sleep(Duration::from_millis(150));
    }

    // join() waits for the thread and returns its result
    let result = handle.join().unwrap();
    println!("Thread returned: {}", result);
}
```

To use data from the surrounding scope in a spawned thread, you must **move** ownership into the closure:

```rust
use std::thread;

fn main() {
    let names = vec!["Alice", "Bob", "Charlie"];

    let handle = thread::spawn(move || {
        // `names` is now owned by this thread
        for name in &names {
            println!("Hello, {}!", name);
        }
        names.len()
    });

    // println!("{:?}", names); // compile error: names was moved
    let count = handle.join().unwrap();
    println!("Greeted {} people", count);
}
```

## Message Passing with Channels

Channels provide a safe way to send data between threads. Rust's standard library offers `mpsc` (multiple producer, single consumer) channels.

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn main() {
    let (tx, rx) = mpsc::channel();

    // Spawn a producer thread
    thread::spawn(move || {
        let messages = vec![
            String::from("hello"),
            String::from("from"),
            String::from("the"),
            String::from("other"),
            String::from("side"),
        ];

        for msg in messages {
            tx.send(msg).unwrap();
            thread::sleep(Duration::from_millis(200));
        }
        // tx is dropped here, which closes the channel
    });

    // Receive messages in the main thread
    // The iterator ends when the channel is closed
    for received in rx {
        println!("Got: {}", received);
    }

    println!("Channel closed, all messages received.");
}
```

You can clone the sender to have multiple producers:

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    for id in 0..3 {
        let tx_clone = tx.clone();
        thread::spawn(move || {
            let msg = format!("message from thread {}", id);
            tx_clone.send(msg).unwrap();
        });
    }

    // Drop the original sender so the channel can close
    drop(tx);

    for msg in rx {
        println!("{}", msg);
    }
}
```

## Shared State with `Arc<Mutex<T>>`

When multiple threads need to read and write the same data, you can use a `Mutex` (mutual exclusion lock) wrapped in an `Arc` (atomic reference count).

- `Mutex<T>` ensures only one thread accesses the data at a time.
- `Arc<T>` is a thread-safe reference-counted pointer that allows shared ownership across threads.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1;
            // lock is automatically released when `num` goes out of scope
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Final count: {}", *counter.lock().unwrap());
}
```

The same pattern works for any shared data structure -- `HashMap`, `Vec`, or your own types.

**Mutex poisoning:** When you call `.lock().unwrap()`, the `unwrap()` will panic if another thread panicked while holding the lock. This is called "mutex poisoning" -- Rust marks the mutex as poisoned to signal that the protected data may be in an inconsistent state. In many cases, panicking is the right response. If you need to recover, use `lock()` without `unwrap()` and handle the `PoisonError`:

```rust
// snippet -- recovery from a poisoned mutex
let mut num = match counter.lock() {
    Ok(guard) => guard,
    Err(poisoned) => {
        eprintln!("Mutex was poisoned, recovering...");
        poisoned.into_inner()
    }
};
```

**`RwLock` for read-heavy workloads:** If your data is read far more often than it is written, consider `std::sync::RwLock<T>`. It allows multiple concurrent readers OR one exclusive writer, which can significantly reduce contention.

## `Send` and `Sync` Traits

Rust uses two marker traits to enforce thread safety at compile time:

- **`Send`**: A type is `Send` if it can be transferred to another thread. Almost all types are `Send`. A notable exception is `Rc<T>` (use `Arc<T>` instead).
- **`Sync`**: A type is `Sync` if it can be referenced from multiple threads simultaneously. A type `T` is `Sync` if `&T` is `Send`.

You rarely implement these traits manually. The compiler derives them automatically when all fields of your struct are `Send`/`Sync`. If you try to send a non-`Send` type across threads, you get a compile error -- not a runtime data race.

```rust
use std::sync::Arc;

fn main() {
    // Rc is NOT Send -- this won't compile:
    // let rc = std::rc::Rc::new(5);
    // std::thread::spawn(move || println!("{}", rc));

    // Arc IS Send -- this works:
    let arc = Arc::new(5);
    std::thread::spawn(move || println!("{}", arc)).join().unwrap();
}
```

## Async/Await with Tokio

For I/O-bound workloads, async/await is more efficient than spawning OS threads for each task. Rust's `async`/`await` syntax lets you write asynchronous code that looks sequential.

You need an async runtime to execute futures. **Tokio** is the most widely used runtime in the Rust ecosystem.

```rust
// In Cargo.toml:
// [dependencies]
// tokio = { version = "1", features = ["full"] }

use std::time::Duration;
use tokio::time::sleep;

async fn fetch_data(id: u32) -> String {
    // Simulate an async operation
    sleep(Duration::from_millis(100 * (id as u64))).await;
    format!("Data from source {}", id)
}

#[tokio::main]
async fn main() {
    // Run tasks concurrently with join!
    let (a, b, c) = tokio::join!(
        fetch_data(1),
        fetch_data(2),
        fetch_data(3),
    );

    println!("{}", a);
    println!("{}", b);
    println!("{}", c);

    // Spawn background tasks
    let mut handles = vec![];
    for i in 0..5 {
        let handle = tokio::spawn(async move {
            sleep(Duration::from_millis(50)).await;
            format!("Task {} complete", i)
        });
        handles.push(handle);
    }

    for handle in handles {
        let result = handle.await.unwrap();
        println!("{}", result);
    }
}
```

Key differences between threads and async tasks:

| Feature | `std::thread` | `tokio::spawn` |
|---------|--------------|----------------|
| Weight | OS thread (typically 2-8 MB stack depending on the OS) | Lightweight task (~few hundred bytes) |
| Scheduling | OS scheduler | Tokio runtime |
| Best for | CPU-bound work | I/O-bound work |
| Blocking | OK to block | Never block -- use `spawn_blocking` |
| Count | Hundreds | Hundreds of thousands |

## Common Patterns

**Parallel map with scoped threads** (no `Arc` needed):

```rust
use std::thread;

fn main() {
    let data = vec![1, 2, 3, 4, 5, 6, 7, 8];

    // thread::scope ensures all threads finish before the scope ends,
    // so threads can safely borrow from the outer scope
    let results: Vec<i32> = thread::scope(|s| {
        let handles: Vec<_> = data
            .chunks(2)
            .map(|chunk| {
                s.spawn(move || {
                    chunk.iter().map(|x| x * x).sum::<i32>()
                })
            })
            .collect();

        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    println!("Chunk sums of squares: {:?}", results);
    println!("Total: {}", results.iter().sum::<i32>());
}
```

**Graceful shutdown:** Drop the sender side of a channel to signal workers to stop. The receiver's iterator will end when all senders are dropped, providing a clean shutdown mechanism without flags or atomics.

## Practice

1. Spawn 4 threads, each computing the sum of a quarter of a large vector, then combine the results in the main thread.
2. Build a producer-consumer system: one thread generates numbers 1 through 100 via a channel, and a consumer thread prints only the primes.
3. Use `Arc<Mutex<Vec<String>>>` to let 3 threads each append 5 messages, then print all messages in the main thread.

Tackle these and more at [Rust exercises](/tracks/rust).

## What's Next?

You now have the tools to write safe concurrent programs in Rust. The compiler has your back -- if it compiles, you won't have data races. From here, explore crates like `rayon` for easy data parallelism, `crossbeam` for advanced concurrency primitives, or dive deeper into `tokio` for building async network services.

Continue practicing at [Rust exercises](/tracks/rust) to solidify these concepts.
