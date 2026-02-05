---
slug: rust-error-handling-and-options-safe-division
title: Safe Division with Option and Result
description: Learn to handle potential errors using Option and Result types by implementing a safe division function and parsing user input.
difficulty: beginner
hints:
  - Option<T> represents a value that might be None - perfect for when division by zero occurs
  - Result<T, E> represents either success (Ok) or failure (Err) - useful for operations that can fail
  - The ? operator can be used to propagate errors in functions that return Result
  - Use match or if let to handle Option and Result values safely
tags:
  - error-handling
  - option
  - result
  - pattern-matching
---

In this exercise, you'll implement safe mathematical operations using Rust's error handling types.

Complete the `safe_divide` function that returns an `Option<f64>` (None when dividing by zero), and the `parse_and_divide` function that returns a `Result<f64, String>` to handle both parsing errors and division errors.

```rust
// A function that performs division safely, returning None if divisor is zero
fn safe_divide(dividend: f64, divisor: f64) -> ___blank_start___Option<f64>___blank_end___ {
    if divisor == 0.0 {
        ___blank_start___None___blank_end___
    } else {
        ___blank_start___Some(dividend / divisor)___blank_end___
    }
}

// A function that parses two strings as numbers and divides them
// Returns Result with either the answer or an error message
fn parse_and_divide(dividend_str: &str, divisor_str: &str) -> Result<f64, String> {
    let dividend = dividend_str.parse::<f64>()
        .map_err(|_| format!("Failed to parse dividend: {}", dividend_str))?;
    
    let divisor = divisor_str.parse::<f64>()
        .map_err(|_| format!("Failed to parse divisor: {}", divisor_str))?;
    
    safe_divide(dividend, divisor)
        .___blank_start___ok_or_else(|| "Cannot divide by zero".to_string())___blank_end___
}

fn main() {
    // Using Option
    match safe_divide(10.0, 2.0) {
        Some(result) => println!("10 / 2 = {}", result),
        None => println!("Cannot divide by zero"),
    }
    
    // Using Result
    match parse_and_divide("20", "4") {
        Ok(result) => println!("20 / 4 = {}", result),
        Err(e) => println!("Error: {}", e),
    }
}
```

## Tests

```rust
#[test]
fn safe_divide_some() {
    let result = safe_divide(10.0, 2.0);
    assert_eq!(result, Some(5.0));
}

#[test]
fn safe_divide_none() {
    let result = safe_divide(10.0, 0.0);
    assert_eq!(result, None);
}

#[test]
fn parse_and_divide_ok() {
    let result = parse_and_divide("20", "4").unwrap();
    assert_eq!(result, 5.0);
}

#[test]
fn parse_and_divide_parse_err() {
    let result = parse_and_divide("not_a_number", "4");
    assert!(result.is_err());
}

#[test]
fn parse_and_divide_zero_err() {
    let result = parse_and_divide("10", "0");
    assert_eq!(result.unwrap_err(), "Cannot divide by zero");
}
```
