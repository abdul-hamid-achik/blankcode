---
slug: rust-concurrency-and-async-threads-and-channels
title: Sharing State and Messages Across Threads
description: Learn Rust's "fearless concurrency" by spawning OS threads that safely share state with Arc and Mutex, and pass values between threads with an mpsc channel.
difficulty: intermediate
hints:
  - Arc<T> lets multiple threads share ownership of the same heap value
  - Mutex<T> only allows one thread at a time to access the value it guards
  - lock() returns a Result wrapping a guard; unwrap() gets the guard itself
  - "std::sync::mpsc::channel() returns a (Sender, Receiver) pair, and cloning the Sender lets many threads send to one Receiver"
tags:
  - concurrency
  - threads
  - mutex
  - channels
---

In this exercise, you'll use Rust's standard library concurrency primitives directly, without an async runtime. You'll learn how to:
- Share mutable state across threads safely with `Arc<Mutex<T>>`
- Wait for spawned threads to finish with `.join()`
- Send values between threads with an `mpsc` channel

Complete the two functions below.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

// Spawn `count` threads that each increment a shared counter by 1.
// Wait for every thread to finish, then return the final count.
fn increment_concurrently(count: usize) -> i32 {
    let counter = ___blank_start___Arc::new(Mutex::new(0))___blank_end___;
    let mut handles = Vec::new();

    for _ in 0..count {
        let counter = ___blank_start___Arc::clone(&counter)___blank_end___;
        let handle = thread::spawn(move || {
            let mut value = ___blank_start___counter.lock().unwrap()___blank_end___;
            *value += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        ___blank_start___handle.join().unwrap()___blank_end___;
    }

    let total = *counter.lock().unwrap();
    total
}

// Spawn a thread per value in `0..count`, each sending its value over a
// channel. Collect every value received on the other end, sorted ascending.
fn collect_messages(count: i32) -> Vec<i32> {
    let (tx, rx) = ___blank_start___std::sync::mpsc::channel()___blank_end___;

    for i in 0..count {
        let tx = tx.clone();
        thread::spawn(move || {
            tx.send(i).unwrap();
        });
    }
    drop(tx);

    let mut received: Vec<i32> = rx.___blank_start___iter()___blank_end___.collect();
    received.sort();
    received
}
```

## Tests

```rust
#[test]
fn increment_concurrently_sums_all_threads() {
    let total = increment_concurrently(50);
    assert_eq!(total, 50);
}

#[test]
fn increment_concurrently_zero_threads() {
    let total = increment_concurrently(0);
    assert_eq!(total, 0);
}

#[test]
fn collect_messages_receives_every_value() {
    let messages = collect_messages(20);
    let expected: Vec<i32> = (0..20).collect();
    assert_eq!(messages, expected);
}

#[test]
fn collect_messages_empty() {
    let messages = collect_messages(0);
    assert!(messages.is_empty());
}
```
