---
title: "Rust Fundamentals"
slug: "rust-fundamentals"
description: "Learn the core building blocks of Rust: variables, ownership, borrowing, and basic types."
track: "rust"
order: 1
difficulty: "beginner"
tags: ["ownership", "borrowing", "basics", "structs", "vec", "cargo"]
---

# Rust Fundamentals

Rust is a systems programming language that guarantees memory safety without a garbage collector. This tutorial covers the foundational concepts you need to start writing Rust programs confidently.

## Running Rust Code

To get started with Rust, install it via [rustup](https://rustup.rs/). Then create and run a new project:

```bash
cargo new my_project   # create a new project
cd my_project
cargo run              # compile and run
```

`cargo` is Rust's build tool and package manager. It handles compiling your code, downloading dependencies, and running tests with `cargo test`.

## Variables and Mutability

In Rust, variables are immutable by default. This is a deliberate design choice that encourages you to think about when and where data changes.

```rust
fn main() {
    let x = 5;
    // x = 6; // This won't compile! Variables are immutable by default.

    let mut y = 10;
    y = 20; // This works because `y` is declared with `mut`.
    println!("x = {}, y = {}", x, y);
}
```

You can also shadow a variable by reusing `let` with the same name. Shadowing lets you transform a value while keeping the variable immutable.

```rust
fn main() {
    let x = 5;
    let x = x + 1;     // shadows the previous x
    let x = x * 2;     // shadows again
    println!("x = {}", x); // prints 12

    // Shadowing also lets you change the type
    let spaces = "   ";
    let spaces = spaces.len(); // now it's a usize
    println!("spaces = {}", spaces);
}
```

## Basic Types

Rust is statically typed. The compiler can usually infer types, but you can always be explicit.

**Scalar types** represent single values:

- Integers: `i8`, `i16`, `i32`, `i64`, `i128`, `isize` (signed) and `u8` through `usize` (unsigned)
- Floats: `f32`, `f64`
- Boolean: `bool`
- Character: `char` (Unicode scalar value, 4 bytes)

**Compound types** group multiple values:

```rust
fn main() {
    // Tuple: fixed-length, mixed types
    let point: (f64, f64, f64) = (1.0, 2.5, 3.7);
    let (x, y, z) = point; // destructuring
    println!("x={}, y={}, z={}", x, y, z);
    println!("first element: {}", point.0); // access by index

    // Array: fixed-length, same type
    let days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    println!("first day: {}", days[0]);

    // Array with explicit type and size
    let zeroes: [i32; 5] = [0; 5]; // five zeros
    println!("{:?}", zeroes);
}
```

## Functions and Control Flow

Functions in Rust use `fn` and require type annotations on parameters. The last expression in a function body is its return value (no semicolon).

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b // no semicolon = this is the return value
}

fn classify_number(n: i32) -> &'static str {
    // &'static str means a string slice that lives for the entire program.
    // String literals like "positive" are stored in the binary and are
    // always valid, so they have the 'static lifetime.
    if n > 0 {
        "positive"
    } else if n < 0 {
        "negative"
    } else {
        "zero"
    }
}

fn main() {
    let sum = add(3, 7);
    println!("3 + 7 = {}", sum);

    for n in [-5, 0, 42] {
        println!("{} is {}", n, classify_number(n));
    }

    // Loop with break returning a value
    let mut counter = 0;
    let result = loop {
        counter += 1;
        if counter == 10 {
            break counter * 2;
        }
    };
    println!("result = {}", result);
}
```

## Ownership Rules

Ownership is Rust's most distinctive feature. It enables memory safety without garbage collection. There are three rules:

1. Each value in Rust has exactly one **owner**.
2. There can only be one owner at a time.
3. When the owner goes out of scope, the value is **dropped** (freed).

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1; // s1 is MOVED to s2; s1 is no longer valid

    // println!("{}", s1); // compile error: value used after move
    println!("{}", s2); // works fine

    // To keep both, clone explicitly
    let s3 = s2.clone();
    println!("s2 = {}, s3 = {}", s2, s3);
}
```

Types that implement the `Copy` trait (integers, booleans, floats, chars, and tuples of `Copy` types) are copied instead of moved. That is why `let x = 5; let y = x;` works without any issues.

## Borrowing

Instead of transferring ownership, you can **borrow** a value by taking a reference. References let you use data without taking ownership.

```rust
fn calculate_length(s: &String) -> usize {
    s.len()
    // s goes out of scope here, but since it doesn't own
    // the String, nothing is dropped
}

fn main() {
    let s = String::from("hello");
    let len = calculate_length(&s); // borrow s
    println!("'{}' has length {}", s, len); // s is still valid
}
```

To modify borrowed data, you need a **mutable reference**:

```rust
fn append_world(s: &mut String) {
    s.push_str(", world!");
}

fn main() {
    let mut greeting = String::from("hello");
    append_world(&mut greeting);
    println!("{}", greeting); // "hello, world!"
}
```

Rust enforces two borrowing rules at compile time:

- You can have **either** one mutable reference **or** any number of immutable references (but not both at the same time).
- References must always be valid (no dangling references).

## Lifetimes Basics

Lifetimes tell the compiler how long references are valid. Most of the time the compiler infers lifetimes automatically, but sometimes you need to annotate them.

```rust
// This function returns a reference, so we need to tell Rust
// how long the returned reference lives relative to the inputs.
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() >= y.len() {
        x
    } else {
        y
    }
}

fn main() {
    let s1 = String::from("long string");
    let result;
    {
        let s2 = String::from("hi");
        result = longest(s1.as_str(), s2.as_str());
        println!("longest: {}", result); // OK: both s1 and s2 are alive
    }
    // This would NOT compile if we tried to use `result` here,
    // because `s2` has been dropped and `result` might refer to it:
    // println!("{}", result); // ERROR: s2 does not live long enough
}
```

The `'a` annotation does not change how long any reference lives. It describes the relationship between the lifetimes of the parameters and the return value so the compiler can verify safety.

## Strings: `String` vs `&str`

Rust has two main string types:

- `String` -- heap-allocated, growable, owned
- `&str` -- an immutable reference to a string slice (borrowed)

```rust
fn greet(name: &str) {
    println!("Hello, {}!", name);
}

fn main() {
    let owned = String::from("Alice");
    let slice: &str = "Bob"; // string literal is &str (with 'static lifetime)

    greet(&owned); // &String auto-coerces to &str
    greet(slice);
}
```

Prefer `&str` as a function parameter type when you only need to read the string. Use `String` when you need ownership or mutation.

## Vectors: `Vec<T>`

Vectors are the most commonly used collection in Rust. A `Vec<T>` is a growable, heap-allocated array.

```rust
fn main() {
    // Create vectors
    let mut numbers: Vec<i32> = Vec::new();
    numbers.push(1);
    numbers.push(2);
    numbers.push(3);

    // Or use the vec! macro
    let mut colors = vec!["red", "green", "blue"];

    // Access elements
    println!("first: {}", numbers[0]);       // panics if out of bounds
    println!("safe: {:?}", numbers.get(10)); // returns None instead

    // Iterate
    for n in &numbers {
        println!("{}", n);
    }

    // Mutate while iterating
    for n in &mut numbers {
        *n *= 2;
    }
    println!("doubled: {:?}", numbers);

    // Other useful methods
    colors.push("yellow");
    let last = colors.pop(); // returns Option<&str>
    println!("popped: {:?}, remaining: {:?}", last, colors);
    println!("length: {}", colors.len());
    println!("contains green: {}", colors.contains(&"green"));
}
```

Vectors own their data. When a vector goes out of scope, all its elements are dropped. You can borrow a vector as a slice (`&[T]`) for read-only access or `&mut [T]` for mutable access.

## Structs and `impl` Blocks

Structs let you group related data together. You add behavior with `impl` blocks.

```rust
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    // Associated function (like a static method) -- called with ::
    fn new(width: f64, height: f64) -> Self {
        Rectangle { width, height }
    }

    // Method -- takes &self, called with .
    fn area(&self) -> f64 {
        self.width * self.height
    }

    fn perimeter(&self) -> f64 {
        2.0 * (self.width + self.height)
    }

    // Method that mutates -- takes &mut self
    fn scale(&mut self, factor: f64) {
        self.width *= factor;
        self.height *= factor;
    }
}

fn main() {
    let mut rect = Rectangle::new(10.0, 5.0);
    println!("area: {}", rect.area());           // 50.0
    println!("perimeter: {}", rect.perimeter()); // 30.0

    rect.scale(2.0);
    println!("scaled area: {}", rect.area());    // 200.0
}
```

Key points about structs:

- `Self` in an `impl` block refers to the type being implemented (here, `Rectangle`).
- Methods take `&self` (borrow), `&mut self` (mutable borrow), or `self` (take ownership).
- Associated functions without `self` (like `new`) are called with `::` syntax.
- Structs are stored on the stack by default. When you assign a struct to a new variable, it is moved (unless it implements `Copy`).

## Practice

Try these exercises to reinforce what you learned:

1. Write a function that takes a `&[i32]` slice and returns the largest element.
2. Create a struct `Circle` with a `radius` field, then write methods for `area` and `circumference`.
3. Experiment with ownership by passing a `String` to a function and trying to use it afterward. Fix it using borrowing.
4. Build a `Vec<String>` of names, then write a function that takes `&[String]` and returns the longest name.

Ready to put these fundamentals to work? Head over to [Rust exercises](/tracks/rust) to practice with interactive coding challenges.

## What's Next?

Now that you understand variables, ownership, borrowing, structs, and vectors, you are ready to explore more powerful abstractions. Next up: [Enums and Pattern Matching](/tutorials/rust-enums-and-pattern-matching), which unlock expressive and safe ways to model your data.
