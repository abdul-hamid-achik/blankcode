---
title: "Fearless Concurrency"
slug: "rust-fearless-concurrency"
description: "Threads, channels, and shared state safe enough to compile, plus the one class of concurrency bug that compiling does not save you from: deadlocks."
track: "rust"
order: 4
difficulty: "advanced"
tags: ["concurrency", "threads", "async", "mutex", "arc", "tokio"]
practice:
  concept: "concurrency-and-async"
  label: "Concurrency and async"
---

Rust's ownership rules do not stop applying when a value crosses a thread boundary — they are what make concurrent code checkable in the first place. The compiler tracks which types are safe to share and safe to send between threads the same way it tracks which references are alive, and it rejects a data race as a type error instead of leaving you to find it under load in production. What it does not do is stop you from deadlocking two threads waiting on each other's locks. That is a runtime property no type system checks, so the discipline of acquiring locks in a consistent order is still yours to keep.

## Spawning threads

`std::thread::spawn` starts a real OS thread and returns a `JoinHandle` you can `.join()` to wait for its result.

```rust
use std::thread;

fn main() {
    let handle = thread::spawn(|| {
        (1..=5).sum::<i32>()
    });

    let result = handle.join().unwrap();
    println!("sum: {}", result);
}
```

A closure passed to `spawn` almost always needs `move` in front of it. The spawned thread might outlive the function that created it, so it cannot borrow anything from that function's stack — it has to own whatever it touches.

```rust
let names = vec!["Alice", "Bob"];
let handle = thread::spawn(move || {
    names.len() // `names` is owned by this closure now
});
```

This is ownership doing the same job it does everywhere else in Rust, just applied across a thread boundary instead of a function boundary: the compiler will not let two threads hold a reference into a stack frame that might unwind before both are done with it.

::code-blank{lang="rust" href="/tracks/rust/concurrency-and-async" label="practice concurrency and async for real"}
---
code: |
  let names = vec!["Alice", "Bob"];
  let handle = thread::spawn(___blank_start___move___blank_end___ || {
      names.len()
  });
---
::

## Message passing with channels

Channels move ownership of a value from one thread to another instead of sharing it. `mpsc::channel()` gives you a sender and a receiver; multiple threads can hold clones of the sender — multiple producer — but only one receiver ever exists — single consumer.

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        for msg in ["hello", "from", "a", "thread"] {
            tx.send(msg.to_string()).unwrap();
        }
        // tx dropped here, closing the channel
    });

    for received in rx {
        println!("{}", received);
    }
}
```

The receiver's `for` loop ends when every sender has been dropped — there is no explicit close call. Reach for this pattern over shared state whenever the shape of the problem is genuinely a pipeline: one side produces, the other consumes, and nothing needs to read the same value from two places at once.

## Shared state: `Arc<Mutex<T>>`

When multiple threads really do need to read and write the same data — not pass it along a pipeline — wrap it in a `Mutex` for exclusive access and an `Arc` for shared ownership across threads. `Mutex<T>` allows exactly one thread in at a time; `Arc<T>` is a thread-safe reference count that lets multiple threads own a handle to the same allocation.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            *counter.lock().unwrap() += 1;
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
    println!("{}", *counter.lock().unwrap());
}
```

The reason `Arc` exists separately from the plain `Rc` you would use in single-threaded code is `Send` and `Sync`, the two marker traits that let the compiler enforce thread safety as a type check. `Rc<T>`'s reference count is a plain, unsynchronized integer — incrementing it from two threads at once is itself a data race, so `Rc<T>` simply does not implement `Send`, and the compiler refuses to compile `thread::spawn` with one captured. `Arc<T>` uses an atomic integer for the count and does implement `Send`, which is the entire difference between the two types from the compiler's point of view.

::code-blank{lang="rust" href="/tracks/rust/concurrency-and-async" label="practice concurrency and async for real"}
---
code: |
  let counter = Arc::new(Mutex::new(0));
  let counter = Arc::___blank_start___clone___blank_end___(&counter);
---
::

## Async/await and when to reach for it

Threads are the right tool for CPU-bound work — each one keeps a core busy. For I/O-bound work — waiting on a socket, a file, a database round trip — an OS thread spends almost all its life parked, and a few hundred of them start costing real memory just in stack space. `async`/`await` compiles a function into a state machine that a runtime like Tokio can suspend at every `.await` point and resume later, on any thread from a small pool, without needing a whole OS thread per pending operation.

```rust
use tokio::time::{sleep, Duration};

async fn fetch(id: u32) -> String {
    sleep(Duration::from_millis(100)).await;
    format!("data {}", id)
}

#[tokio::main]
async fn main() {
    let (a, b) = tokio::join!(fetch(1), fetch(2));
    println!("{} {}", a, b);
}
```

The rule that keeps this fast: never block inside an `async fn`. A call like `std::thread::sleep` or a synchronous file read does not yield back to the runtime — it parks the entire worker thread the runtime was using to make progress on every other task scheduled onto it, not just this one. `tokio::time::sleep(...).await` yields; `std::thread::sleep(...)` does not, and mixing the two in async code is one of the most common ways to silently stall an entire async application.

::code-blank{lang="rust" href="/tracks/rust/concurrency-and-async" label="practice concurrency and async for real"}
---
code: |
  async fn fetch(id: u32) -> String {
      sleep(Duration::from_millis(100)).___blank_start___await___blank_end___;
      format!("data {}", id)
  }
---
::

## Where this bites

**Holding a `Mutex` guard across an `.await` point.** The lock stays held while the task is suspended, which can deadlock the runtime if the same task, or a waiter it depends on, needs that lock to make progress on resuming. Drop the guard — end the block, or clone what you need out of it — before the first `.await` in the same scope.

**Acquiring locks in different orders on different threads.** Thread A locks `x` then waits for `y`; thread B locks `y` then waits for `x`; neither is a compile error, and both threads wait forever. The compiler checks data-race freedom, not deadlock freedom, so keep a fixed, documented lock order across the whole codebase and this class of bug cannot occur.

**Treating a poisoned mutex as unrecoverable.** `.lock().unwrap()` panics if another thread panicked while holding the lock, but the data usually is not actually corrupted — most panics happen before or after the critical mutation, not mid-write. `match counter.lock() { Ok(g) => g, Err(p) => p.into_inner() }` recovers the guard once you have verified the invariant still holds.

**Blocking inside an async function.** A synchronous, CPU-heavy call or a blocking I/O call inside `async fn` stalls the worker thread it runs on, and Tokio's default runtime shares a small pool of those across every task. Move blocking work into `tokio::task::spawn_blocking`, which runs it on a thread dedicated to blocking calls instead of one the async scheduler needs back.
