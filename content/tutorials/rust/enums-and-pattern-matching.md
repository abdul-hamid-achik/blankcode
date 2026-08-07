---
title: "Enums and Pattern Matching"
slug: "rust-enums-and-pattern-matching"
description: "How Rust enums make invalid states unrepresentable, and how exhaustive matching, Option, and Result turn missed cases into compile errors instead of runtime bugs."
track: "rust"
order: 2
difficulty: "intermediate"
tags: ["enums", "pattern-matching", "option", "result"]
practice:
  concept: "structs-enums-and-pattern-matching"
  label: "Structs, enums and matching"
---

An enum in Rust is not a set of named integers. It is a type that must be exactly one of several distinct shapes, each carrying its own data. Combined with `match`, which the compiler forces to cover every case, enums let you encode "this cannot happen" directly into the type system instead of hoping a comment or a runtime check catches it.

## Enums model exclusive alternatives

A struct groups data that all exists at once — width and height, both present together. An enum is the opposite: a value that is exactly one of its variants, never a partial mix of two. A `Shape` that is either a circle's radius or a rectangle's width and height, never both, cannot be expressed correctly with two optional fields on a struct — you would need a runtime check to guarantee exactly one was set, and nothing stops a caller from setting both or neither. An enum makes the invalid state unrepresentable. The compiler will not compile code that tries to construct it.

```rust
enum Shape {
    Circle(f64),                          // radius
    Rectangle(f64, f64),                  // width, height
    Triangle { a: f64, b: f64, c: f64 },  // named fields
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle(w, h) => w * h,
        Shape::Triangle { a, b, c } => {
            let s = (a + b + c) / 2.0;
            (s * (s - a) * (s - b) * (s - c)).sqrt()
        }
    }
}
```

Each variant can carry completely different data — tuple fields, named fields, or nothing at all. This is what people mean by "algebraic data type": the type is the sum of its variants, and a value is tagged with exactly which one it is, invisibly, in a couple of bytes.

## `match`: exhaustive by construction

`match` compares a value against patterns in order and runs the first one that fits. The property that makes it more than a fancy `switch` is that the compiler requires it to be exhaustive — every variant of the matched type must be handled, or the code does not compile.

```rust
fn describe(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1..=9 => "single digit",
        _ => "large number",
    }
}
```

This is the payoff for modeling data as an enum in the first place. Add a fourth `Shape` variant later, and every `match` on `Shape` across the codebase that lacks a catch-all arm fails to compile until you handle the new case. A missed case in a language with fallthrough `switch` is a runtime bug found in production; here it is a compile error found the moment you add the variant.

::code-blank{lang="rust" href="/tracks/rust/structs-enums-and-pattern-matching" label="practice structs, enums and matching for real"}
---
code: |
  fn describe(n: i32) -> &'static str {
      ___blank_start___match___blank_end___ n {
          0 => "zero",
          _ => "nonzero",
      }
  }
---
::

## `Option<T>` instead of null

Rust has no `null`. A value that might be absent is `Option<T>`, an enum with two variants: `Some(T)` and `None`. Both are in the standard prelude — no import needed — and because `Option` is an ordinary enum, the exhaustiveness rule applies to it too: you cannot read the inner value without the compiler making you account for the `None` case somewhere.

```rust
fn find_first_even(numbers: &[i32]) -> Option<i32> {
    for &n in numbers {
        if n % 2 == 0 {
            return Some(n);
        }
    }
    None
}
```

`.unwrap()` extracts the value and panics on `None`. Reach for it in a test or a throwaway prototype, never in code a user's input can reach. `unwrap_or(default)`, `map`, and `?` (inside a function that itself returns `Option`) are the versions that keep the absence explicit instead of crashing on it.

::code-blank{lang="rust" href="/tracks/rust/structs-enums-and-pattern-matching" label="practice structs, enums and matching for real"}
---
code: |
  fn find_first_even(numbers: &[i32]) -> Option<i32> {
      for &n in numbers {
          if n % 2 == 0 {
              return ___blank_start___Some___blank_end___(n);
          }
      }
      None
  }
---
::

## `Result<T, E>` and the `?` operator

`Result<T, E>` is `Option`'s sibling for operations that fail with a reason attached: `Ok(T)` or `Err(E)`. The `?` operator is what makes it usable without nesting — inside a function that returns `Result`, `expr?` unwraps `Ok` and returns early on `Err`.

```rust
use std::num::ParseIntError;

fn parse_and_double(input: &str) -> Result<i32, ParseIntError> {
    let number = input.parse::<i32>()?;
    Ok(number * 2)
}
```

The non-obvious part: `?` does not just return the error, it converts it through `From::from` on the way out. If your function's error type implements `From<ParseIntError>`, you can `?` a `ParseIntError` and a `std::io::Error` and a database error from the same function, all converting into one error type, with zero explicit `.map_err()` calls. That mechanism is behind most of the "one error enum per module" designs you will see in real Rust codebases.

::code-blank{lang="rust" href="/tracks/rust/structs-enums-and-pattern-matching" label="practice structs, enums and matching for real"}
---
code: |
  fn parse_and_double(input: &str) -> Result<i32, ParseIntError> {
      let number = input.parse::<i32>()?;
      ___blank_start___Ok___blank_end___(number * 2)
  }
---
::

## `if let`, `while let`, and `let-else`

When you only care about one variant, a full `match` is ceremony. `if let Some(x) = opt { ... }` handles the case you care about and ignores the rest; `while let Some(x) = stack.pop() { ... }` loops until a pattern stops matching, the idiomatic way to drain anything that yields `Option`.

```rust
let mut stack = vec![1, 2, 3];
while let Some(top) = stack.pop() {
    println!("{}", top);
}
```

`let-else`, stable since Rust 1.65, destructures a value or diverges — returns, breaks, or continues — in one line, flattening an early-exit pattern that used to need a nested `match`:

```rust
fn process(input: Option<&str>) -> String {
    let Some(name) = input else {
        return String::from("anonymous");
    };
    format!("Hello, {}", name)
}
```

Reach for `if let` when there is one variant you care about and a boring default for the rest. Reach for a full `match` the moment three or more cases all matter — at that point the exhaustiveness check is doing real work for you, and collapsing it into a chain of `if let ... else if let` throws that away.

## Where this bites

**Calling `.unwrap()` outside a test or a prototype.** It turns a value that might be absent into a guaranteed panic the moment it actually is absent. Match on it, use a combinator, or propagate with `?` anywhere the input is not fully under your control.

**Reaching for `unwrap_or` with an expensive or side-effecting default.** `opt.unwrap_or(compute())` evaluates `compute()` unconditionally, even when `opt` is `Some`, because arguments are evaluated before the call happens. Use `unwrap_or_else(|| compute())` once the fallback is not a cheap literal — the closure runs only when it is actually needed.

**Replacing `match` with a chain of `if let ... else if let`.** It compiles, but it throws away the one thing `match` gives you for free: a compile error when a new enum variant shows up and nobody handled it. Keep `match` for anything with more than one variant that matters.

**Matching by value when you meant to match by reference.** Matching a `&Option<T>` directly needs either `&Some(x)` patterns or a `.as_ref()` call first — Rust's match ergonomics smooth most of this over automatically, but when they do not, the fix is almost always adding or removing a `&`, not restructuring the match.
