---
slug: rust-concurrency-and-async-fetch-users
title: Async User Data Fetcher
description: Learn to use async/await in Rust by creating a simple asynchronous function that simulates fetching user data with delays.
difficulty: beginner
hints:
  - Use the `async` keyword to define an asynchronous function
  - The `await` keyword is used to wait for async operations to complete
  - tokio's `sleep` function requires a Duration parameter
  - The main function needs to be marked as async with the tokio runtime
tags:
  - async
  - await
  - tokio
  - concurrency
---

In this exercise, you'll create an asynchronous function that simulates fetching user data from a server. You'll learn how to:
- Define async functions
- Use `.await` to wait for async operations
- Set up a tokio runtime for async execution

Complete the code below to make the async function work properly. The function should simulate a 2-second delay before returning user information.

```rust
use tokio::time::{sleep, Duration};

// Define an async function that returns a String
___blank_start___async fn___blank_end___ fetch_user_data(user_id: u32) -> String {
    println!("Fetching data for user {}...", user_id);
    
    // Simulate a network delay of 2 seconds
    sleep(Duration::from_secs(2)).___blank_start___await___blank_end___;
    
    format!("User {} data retrieved", user_id)
}

// Mark main as async with tokio runtime
#[tokio::main]
___blank_start___async fn___blank_end___ main() {
    let result = fetch_user_data(42).___blank_start___await___blank_end___;
    println!("{}", result);
}
```

## Tests

```rust
#[tokio::test]
async fn async_user_fetcher_runs() {
    let result = fetch_user_data(42).await;
    assert!(result.contains("User 42"));
}
```
