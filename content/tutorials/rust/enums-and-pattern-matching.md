---
title: "Enums and Pattern Matching"
slug: "rust-enums-and-pattern-matching"
description: "Master Rust enums, Option, Result, and the powerful match expression."
track: "rust"
order: 2
difficulty: "intermediate"
tags: ["enums", "pattern-matching", "option", "result"]
---

# Enums and Pattern Matching

Enums in Rust are far more powerful than in most languages. Combined with pattern matching, they give you a type-safe way to represent and handle different cases in your programs.

## Defining Enums

An enum lets you define a type by listing its possible variants. Each variant can optionally carry data.

```rust
enum Direction {
    North,
    South,
    East,
    West,
}

enum Shape {
    Circle(f64),                    // radius
    Rectangle(f64, f64),            // width, height
    Triangle { a: f64, b: f64, c: f64 }, // named fields
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle(w, h) => w * h,
        Shape::Triangle { a, b, c } => {
            // Heron's formula
            let s = (a + b + c) / 2.0;
            (s * (s - a) * (s - b) * (s - c)).sqrt()
        }
    }
}

fn main() {
    let shapes = vec![
        Shape::Circle(5.0),
        Shape::Rectangle(4.0, 6.0),
        Shape::Triangle { a: 3.0, b: 4.0, c: 5.0 },
    ];

    for shape in &shapes {
        println!("Area: {:.2}", area(shape));
    }
}
```

Notice how each variant can hold completely different data. This is sometimes called a "tagged union" or "algebraic data type."

## The `match` Expression

`match` is Rust's primary pattern matching construct. It compares a value against a series of patterns and runs the code for the first match.

```rust
fn describe_number(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1..=9 => "single digit",
        10..=99 => "double digit",
        100..=999 => "triple digit",
        _ => "large number", // _ is the catch-all pattern
    }
}

fn main() {
    for n in [0, 7, 42, 256, 10000] {
        println!("{}: {}", n, describe_number(n));
    }
}
```

A key property of `match` is that it must be **exhaustive** -- you must handle every possible value. The compiler enforces this, which prevents bugs from forgotten cases.

## `Option<T>`: Nullable Values Done Right

Rust has no `null`. Instead, the standard library provides `Option<T>` to represent a value that might be absent. `Option` and `Result` are part of the standard prelude -- they are automatically imported into every Rust program, so you can use `Some`, `None`, `Ok`, and `Err` directly without any `use` statement.

```rust
// This is how Option is defined in the standard library.
// You do NOT need to define it yourself -- it's always available.
// enum Option<T> {
//     Some(T),
//     None,
// }
```

Because `Option` is an enum, the compiler forces you to handle both cases before using the inner value.

```rust
fn find_first_even(numbers: &[i32]) -> Option<i32> {
    for &n in numbers {
        if n % 2 == 0 {
            return Some(n);
        }
    }
    None
}

fn main() {
    let nums = vec![1, 3, 5, 8, 13];

    match find_first_even(&nums) {
        Some(n) => println!("First even: {}", n),
        None => println!("No even numbers found"),
    }

    // Useful Option methods
    let maybe_value: Option<i32> = Some(42);
    println!("unwrap_or: {}", maybe_value.unwrap_or(0));
    println!("map: {:?}", maybe_value.map(|v| v * 2));
    println!("is_some: {}", maybe_value.is_some());

    let nothing: Option<i32> = None;
    println!("unwrap_or: {}", nothing.unwrap_or(0));
}
```

**Warning about `unwrap()`:** Calling `.unwrap()` on a `None` value will **panic** and crash your program. Use `unwrap()` only when you are absolutely certain the value is `Some`, or in quick prototypes. Prefer `unwrap_or()`, `unwrap_or_else()`, `match`, or the `?` operator for production code.

## `Result<T, E>`: Error Handling

`Result` is how Rust handles operations that can fail. Like `Option`, it is part of the prelude.

```rust
// Also defined in the standard library -- always available.
// enum Result<T, E> {
//     Ok(T),
//     Err(E),
// }
```

```rust
use std::num::ParseIntError;

fn parse_and_double(input: &str) -> Result<i32, ParseIntError> {
    let number = input.parse::<i32>()?; // ? propagates the error
    Ok(number * 2)
}

fn main() {
    let inputs = vec!["21", "abc", "50"];

    for input in inputs {
        match parse_and_double(input) {
            Ok(value) => println!("'{}' => {}", input, value),
            Err(e) => println!("'{}' => Error: {}", input, e),
        }
    }
}
```

The `?` operator is syntactic sugar: if the `Result` is `Err`, it returns the error from the current function immediately. If it is `Ok`, it unwraps the value. This keeps error handling concise without hiding failures.

Just like with `Option`, calling `.unwrap()` on an `Err` will **panic**. Use `?`, `match`, or combinator methods instead.

## Chaining Results

`Result` has combinator methods similar to `Option` that let you chain operations cleanly.

```rust
fn parse_config(input: &str) -> Result<(String, u16), String> {
    let parts: Vec<&str> = input.split(':').collect();

    let host = parts
        .first()
        .filter(|h| !h.is_empty())
        .map(|h| h.to_string())
        .ok_or_else(|| "missing host".to_string())?;

    let port = parts
        .get(1)
        .ok_or_else(|| "missing port".to_string())?
        .parse::<u16>()
        .map_err(|e| format!("invalid port: {}", e))?;

    Ok((host, port))
}

fn main() {
    let cases = vec!["localhost:8080", "example.com:abc", ":3000", "noport"];

    for input in cases {
        match parse_config(input) {
            Ok((host, port)) => println!("{} => {}:{}", input, host, port),
            Err(e) => println!("{} => Error: {}", input, e),
        }
    }
}
```

## `if let` and `while let`

When you only care about one variant, `if let` is more concise than a full `match`.

```rust
fn main() {
    let config_max: Option<u32> = Some(100);

    // Instead of a full match:
    if let Some(max) = config_max {
        println!("Max configured: {}", max);
    }

    // while let is great for iterators that return Option
    let mut stack = vec![1, 2, 3, 4, 5];
    while let Some(top) = stack.pop() {
        println!("Popped: {}", top);
    }

    // Combining if let with else
    let value: Result<i32, &str> = Err("not found");
    if let Ok(n) = value {
        println!("Got: {}", n);
    } else {
        println!("Value was an error");
    }
}
```

## `let-else` Syntax

Since Rust 1.65, `let-else` provides a concise way to destructure a value or diverge (return, break, continue) if it does not match.

```rust
fn process_name(input: Option<&str>) -> String {
    // If input is None, return early
    let Some(name) = input else {
        return String::from("anonymous");
    };

    // `name` is now a &str, available in the rest of the function
    format!("Hello, {}!", name)
}

fn main() {
    println!("{}", process_name(Some("Alice"))); // "Hello, Alice!"
    println!("{}", process_name(None));           // "anonymous"
}
```

This is especially useful when working with `Option` or `Result` values where you want to bail out early on the failure case without nesting.

## Common Patterns

Here are patterns you will use frequently in real Rust code.

**Matching with guards:**

```rust
fn classify(n: i32) -> &'static str {
    match n {
        n if n < 0 => "negative",
        0 => "zero",
        n if n % 2 == 0 => "positive even",
        _ => "positive odd",
    }
}
```

**Destructuring tuples and structs in match:**

```rust
struct Point {
    x: f64,
    y: f64,
}

fn quadrant(p: &Point) -> &'static str {
    // Note: a point on an axis (where x or y is 0.0) does not belong
    // to any quadrant. For simplicity this example treats axis points
    // as belonging to the quadrant where >= applies.
    match (p.x >= 0.0, p.y >= 0.0) {
        (true, true) => "first",
        (false, true) => "second",
        (false, false) => "third",
        (true, false) => "fourth",
    }
}
```

**Using `matches!` macro for boolean checks:**

```rust
fn main() {
    let status = "active";
    let is_valid = matches!(status, "active" | "pending");
    println!("Valid: {}", is_valid);
}
```

## Practice

1. Define an enum `Command` with variants `Quit`, `Echo(String)`, `Move { x: i32, y: i32 }`, and `ChangeColor(u8, u8, u8)`. Write a function that processes each command.
2. Write a function that takes a `Vec<Option<i32>>` and returns the sum of all `Some` values.
3. Create a `divide(a: f64, b: f64) -> Result<f64, String>` function that returns an error when dividing by zero.

Practice these concepts with interactive exercises at [Rust exercises](/tracks/rust).

## What's Next?

You now know how to model data with enums and handle every case safely with pattern matching. Next up: [Traits and Generics](/tutorials/rust-traits-and-generics), which let you write flexible, reusable code that works across many types.
