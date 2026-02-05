---
slug: rust-traits-and-generics-printable-container
title: Create a Generic Printable Container
description: Learn how to define and implement traits with generic types by creating a container that can hold and display any printable value.
difficulty: beginner
hints:
  - Traits define shared behavior that types can implement
  - Generic type parameters use angle brackets like <T>
  - The Display trait is used for user-facing output
  - Trait bounds constrain what types can be used with generics
tags:
  - traits
  - generics
  - rust
  - type-system
---

In this exercise, you'll create a `Container<T>` struct that can hold any value and a `Printable` trait to display its contents. This teaches you how traits and generics work together in Rust.

**Your tasks:**
1. Define a `Printable` trait with a `print` method
2. Create a generic `Container<T>` struct
3. Implement the `Printable` trait for `Container<T>` where T implements `Display`
4. Create a function that accepts any type implementing `Printable`

```rust
use std::fmt::Display;

// Define a trait named Printable with a method 'print' that takes &self
trait ___blank_start___Printable___blank_end___ {
    fn print(&self);
}

// Define a generic struct Container that holds a value of type T
struct Container<___blank_start___T___blank_end___> {
    value: T,
}

// Implement Printable for Container<T> where T implements Display
impl<T: ___blank_start___Display___blank_end___> Printable for Container<T> {
    fn print(&self) {
        println!("Container holds: {}", self.value);
    }
}

// Generic function that accepts any type implementing Printable
fn display_item<T: ___blank_start___Printable___blank_end___>(item: &T) {
    item.print();
}

fn main() {
    let number_container = Container { value: 42 };
    let string_container = Container { value: "Hello, Rust!" };
    
    display_item(&number_container);
    display_item(&string_container);
}
```

## Tests

```rust
use std::fmt::Display;

#[test]
fn container_prints_values() {
    let number_container = Container { value: 42 };
    let string_container = Container { value: "Hello, Rust!" };
    display_item(&number_container);
    display_item(&string_container);
}

#[test]
fn printable_trait_bound() {
    fn assert_printable<T: Printable>(_: &T) {}
    let container = Container { value: 1 };
    assert_printable(&container);
}

#[test]
fn display_bound_compiles() {
    fn assert_display<T: Display>(_: &T) {}
    let container = Container { value: 10 };
    assert_display(&container.value);
}
```
