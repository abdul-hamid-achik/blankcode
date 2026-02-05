---
slug: rust-error-handling-and-options-safe-division
title: Safe Division with Option and Result
description: Learn to handle errors and absent values using Rust's Option and Result types by implementing a safe division calculator.
difficulty: beginner
hints:
  - Option<T> represents a value that might be absent (Some(T) or None)
  - Result<T, E> represents either success (Ok(T)) or failure (Err(E))
  - Use pattern matching or methods like unwrap_or() to handle these types
  - Division by zero should return an error, not panic
tags:
  - error-handling
  - option
  - result
  - pattern-matching
---

In this exercise, you'll implement safe division functions that handle edge cases gracefully using Rust's `Option` and `Result` types.

Complete the functions below:
1. `safe_divide_option` - Returns `None` when dividing by zero, otherwise `Some(result)`
2. `safe_divide_result` - Returns an `Err` with a message when dividing by zero, otherwise `Ok(result)`
3. `get_value_or_default` - Extracts a value from an Option or returns a default

```rust
// Function that returns Option to handle division by zero
fn safe_divide_option(numerator: f64, denominator: f64) -> Option<f64> {
    if denominator == 0.0 {
        ___blank_start___None___blank_end___
    } else {
        ___blank_start___Some(numerator / denominator)___blank_end___
    }
}

// Function that returns Result to provide error information
fn safe_divide_result(numerator: f64, denominator: f64) -> Result<f64, String> {
    if denominator == 0.0 {
        ___blank_start___Err("Cannot divide by zero".to_string())___blank_end___
    } else {
        ___blank_start___Ok(numerator / denominator)___blank_end___
    }
}

// Function that unwraps an Option with a default value
fn get_value_or_default(option: Option<f64>, default: f64) -> f64 {
    ___blank_start___option.unwrap_or(default)___blank_end___
}

fn main() {
    // Testing Option-based division
    let result1 = safe_divide_option(10.0, 2.0);
    println!("10 / 2 = {:?}", result1);
    
    let result2 = safe_divide_option(10.0, 0.0);
    println!("10 / 0 = {:?}", result2);
    
    // Testing Result-based division
    match safe_divide_result(15.0, 3.0) {
        Ok(value) => println!("15 / 3 = {}", value),
        Err(e) => println!("Error: {}", e),
    }
    
    match safe_divide_result(15.0, 0.0) {
        Ok(value) => println!("15 / 0 = {}", value),
        Err(e) => println!("Error: {}", e),
    }
    
    // Testing default value extraction
    let some_value = Some(42.0);
    let no_value: Option<f64> = None;
    
    println!("Value or default: {}", get_value_or_default(some_value, 0.0));
    println!("Value or default: {}", get_value_or_default(no_value, 99.0));
}
```

## Tests

```rust
#[test]
fn safe_divide_option_some() {
    let result = safe_divide_option(10.0, 2.0);
    assert_eq!(result, Some(5.0));
}

#[test]
fn safe_divide_option_none() {
    let result = safe_divide_option(10.0, 0.0);
    assert_eq!(result, None);
}

#[test]
fn safe_divide_result_ok() {
    let result = safe_divide_result(15.0, 3.0).unwrap();
    assert_eq!(result, 5.0);
}

#[test]
fn safe_divide_result_err() {
    let result = safe_divide_result(10.0, 0.0);
    assert_eq!(result.unwrap_err(), "Cannot divide by zero");
}

#[test]
fn get_value_or_default_some() {
    let value = get_value_or_default(Some(42.0), 0.0);
    assert_eq!(value, 42.0);
}

#[test]
fn get_value_or_default_none() {
    let value = get_value_or_default(None, 99.0);
    assert_eq!(value, 99.0);
}
```
