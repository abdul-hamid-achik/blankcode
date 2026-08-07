---
title: "Rust Fundamentals"
slug: "rust-fundamentals"
description: "Ownership, borrowing, and the core types every Rust program is built from, explained through what the compiler is protecting rather than analogy."
track: "rust"
order: 1
difficulty: "beginner"
tags: ["ownership", "borrowing", "basics", "structs", "vec", "cargo"]
practice:
  concept: "ownership-and-borrowing"
  label: "Ownership and borrowing"
---

Rust's ownership system is not an obstacle between you and the code you want to write. It is the compiler proving, once, at build time, a set of properties most languages either give up on or check at runtime with a garbage collector. This tutorial covers the vocabulary that makes the rest of Rust legible: how values move, how references borrow, and the handful of types that show up in nearly everything you write.

## Setup

Install Rust via [rustup](https://rustup.rs/), then scaffold and run a project:

```bash
cargo new my_project
cd my_project
cargo run
```

`cargo` is the build tool, package manager, and test runner in one binary — `cargo build`, `cargo test`, and `cargo run` all read the same `Cargo.toml`. There is no separate dependency-resolution step: add a crate to `Cargo.toml` and the next cargo command fetches and compiles it.

## Ownership: what the compiler is protecting

Every value has exactly one owner, and the value is dropped the instant its owner goes out of scope. That is the whole allocator story, but the rule that makes it enforceable at compile time is the one that matters: assign a heap-allocated value to a new variable, and the old one is invalidated.

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1; // s1 is moved into s2

    // println!("{}", s1); // compile error: value borrowed after move
    println!("{}", s2);
}
```

This is not a stylistic nicety. Two variables both believing they own the same heap buffer is a double-free waiting to happen the moment either goes out of scope. The compiler does not track a reference count at runtime the way `Rc` does — it tracks ownership statically and refuses to compile code where two live bindings could both try to free the same memory. That is the trick behind "no garbage collector, no crashes": the check happens once, and then it costs nothing at runtime.

Types cheap to duplicate bit-for-bit — integers, floats, `bool`, `char`, and tuples of those — implement `Copy` and skip this rule. `let y = x;` after `let x = 5;` copies four bytes; there is nothing to double-free, so nothing moves. Copy-versus-move is not about a type's size, it is about whether a bitwise duplicate is a fully independent, valid value. A `String` fails that test because two copies of its pointer/length/capacity triple would both claim the same heap allocation.

When you genuinely need two independent copies, say so with `.clone()`. Cloning is fine when the data is small, when a copy needs to outlive the original, or when the code is nowhere near a hot path — reach for it without guilt. It becomes a smell only when you clone inside a loop to dodge a borrow error you have not actually diagnosed; that pattern usually means the function should take a reference instead of taking ownership.

::code-blank{lang="rust" href="/tracks/rust/ownership-and-borrowing" label="practice ownership and borrowing for real"}
---
code: |
  let s1 = String::from("hello");
  let s2 = s1.___blank_start___clone___blank_end___();
  println!("{} {}", s1, s2);
---
::

## Borrowing: aliasing and mutation, never both

Instead of moving ownership, you can borrow a value by taking a reference. A `&T` lets you read; a `&mut T` lets you read and write. The compiler enforces one rule about them: at any point in the program, either one mutable reference or any number of immutable references, never both. That sounds arbitrary until you see what it rules out — mutating a `Vec` while another part of the code iterates over it, invalidating a pointer someone else is still holding, two threads writing the same memory unsynchronized. Every one of those is a real bug class in languages that let you alias and mutate freely, and Rust converts each into a compile error without running the program once.

```rust
fn calculate_length(s: &String) -> usize {
    s.len()
}

fn append_world(s: &mut String) {
    s.push_str(", world");
}

fn main() {
    let mut greeting = String::from("hello");
    println!("length: {}", calculate_length(&greeting));
    append_world(&mut greeting);
    println!("{}", greeting);
}
```

Mutability in Rust is a property of the binding, not of the value's origin. `&mut self` in a method does not ask whether the struct was somehow born mutable — it asks whether the variable calling the method was declared with `mut`. That is why `let rect = Rectangle::new(...)` cannot call a `&mut self` method even though `Rectangle` has no immutability built into its definition: the restriction lives on `rect`, not on the type.

::code-blank{lang="rust" href="/tracks/rust/ownership-and-borrowing" label="practice ownership and borrowing for real"}
---
code: |
  fn append_world(s: &___blank_start___mut___blank_end___ String) {
      s.push_str(", world");
  }
---
::

## The types you reach for daily

Scalars are what you would expect — signed and unsigned integers (`i32`, `u8`, `usize`, and friends), `f64`, `bool`, `char` — with one Rust-specific wrinkle: integer overflow panics in debug builds and silently wraps in release builds. Do not rely on either behavior deliberately; use `checked_add`, `wrapping_add`, or `saturating_add` when overflow is a real possibility.

Text splits into two owned-versus-borrowed types. `String` is heap-allocated, growable, and owned. `&str` is a borrowed view into string data — either into a `String`'s buffer, or into the compiled binary itself, which is why a literal like `"hello"` has the `'static` lifetime. Default to `&str` for function parameters — it accepts both a `&String` and a literal — and reach for `String` only when the function needs to own or grow the text.

```rust
fn greet(name: &str) {
    println!("Hello, {}", name);
}

fn main() {
    let owned = String::from("Alice");
    greet(&owned); // &String coerces to &str
    greet("Bob");  // a literal is already &str
}
```

For collections, `Vec<T>` is the default: a growable, heap-allocated, contiguous array. Fixed-size arrays (`[T; N]`) show up when the length is known and small — a three-element color tuple, a lookup table. Indexing a `Vec` panics out of bounds; `.get()` returns `Option<&T>` for when a missing index is a real possibility rather than a bug.

```rust
fn main() {
    let mut numbers = vec![1, 2, 3];
    numbers.push(4);

    for n in &mut numbers {
        *n *= 2;
    }
    println!("{:?}", numbers); // [2, 4, 6, 8]
}
```

::code-blank{lang="rust" href="/tracks/rust/ownership-and-borrowing" label="practice ownership and borrowing for real"}
---
code: |
  let numbers = ___blank_start___vec___blank_end___![1, 2, 3];
---
::

## Structs and behavior

A struct groups related data; an `impl` block attaches behavior to it. Associated functions — no `self` parameter, called with `::` — are how you write constructors; there is no special `new` keyword, `new` is only a convention. Methods take `&self`, `&mut self`, or, rarely, `self` by value, and that choice is the method's contract: `&self` promises it only reads, `&mut self` says it will mutate, `self` says it consumes the value and the caller loses access afterward.

```rust
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    fn new(width: f64, height: f64) -> Self {
        Rectangle { width, height }
    }

    fn area(&self) -> f64 {
        self.width * self.height
    }

    fn scale(&mut self, factor: f64) {
        self.width *= factor;
        self.height *= factor;
    }
}

fn main() {
    let mut rect = Rectangle::new(10.0, 5.0);
    rect.scale(2.0);
    println!("area: {}", rect.area());
}
```

`Self` inside an `impl` block always means "the type this block implements." Write `Self` instead of repeating `Rectangle`, and the method survives a rename for free.

## Where this bites

**Cloning to escape the borrow checker.** A `.clone()` sprinkled in wherever the compiler complains gets code compiling, but it usually means the function signature is wrong — it is asking for ownership when a reference would do. Change the parameter to a reference first, and reach for `.clone()` only after that genuinely does not fit.

**Returning a reference to a local variable.** A function that builds a `String` internally and tries to return `&str` into it will not compile, because the local is dropped at the end of the function and the reference would dangle. Return the owned `String` instead, and let the caller decide whether to borrow it.

**Mutating a `Vec` while iterating over it.** `for x in &v { v.push(y) }` does not compile, and that is the point: growing a `Vec` can reallocate its buffer, which would invalidate every reference the iterator is holding. Collect the values to add into a separate `Vec` first, then extend after the loop ends.

**Assuming integer overflow always panics.** It panics in debug builds and silently wraps in `--release`. Code that depends on overflow being caught should use `checked_add`, which returns `Option`, rather than relying on which build profile happens to be active.
