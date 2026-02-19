---
title: "Traits and Generics"
slug: "rust-traits-and-generics"
description: "Write flexible, reusable Rust code with traits, generics, and trait bounds."
track: "rust"
order: 3
difficulty: "intermediate"
tags: ["traits", "generics", "trait-bounds", "iterator", "dynamic-dispatch"]
---

# Traits and Generics

Traits define shared behavior across types. Generics let you write code that works with many types. Together, they are the foundation of Rust's approach to polymorphism and code reuse.

## Defining Traits

A trait is a collection of methods that types can implement. Think of it as an interface that describes what a type can do.

```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct Article {
    title: String,
    author: String,
    content: String,
}

struct Tweet {
    username: String,
    text: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        // Safe string slicing: use char_indices to handle multi-byte
        // UTF-8 characters and short strings without panicking.
        let end = self.content.char_indices()
            .nth(20)
            .map(|(i, _)| i)
            .unwrap_or(self.content.len());
        format!("{} by {} - {}...", self.title, self.author, &self.content[..end])
    }
}

impl Summary for Tweet {
    fn summarize(&self) -> String {
        format!("@{}: {}", self.username, self.text)
    }
}

fn main() {
    let article = Article {
        title: String::from("Rust 2026"),
        author: String::from("The Rust Team"),
        content: String::from("This year brings exciting new features to the language..."),
    };
    let tweet = Tweet {
        username: String::from("rustlang"),
        text: String::from("Rust is awesome!"),
    };

    println!("{}", article.summarize());
    println!("{}", tweet.summarize());
}
```

## Default Implementations

Traits can provide default method bodies. Types can override them or use the default.

```rust
trait Greet {
    fn name(&self) -> &str;

    fn greeting(&self) -> String {
        format!("Hello, {}!", self.name())
    }

    fn farewell(&self) -> String {
        format!("Goodbye, {}!", self.name())
    }
}

struct User {
    username: String,
}

impl Greet for User {
    fn name(&self) -> &str {
        &self.username
    }

    // Override just the greeting
    fn greeting(&self) -> String {
        format!("Welcome back, {}!", self.name())
    }

    // farewell() uses the default implementation
}

fn main() {
    let user = User { username: String::from("alice") };
    println!("{}", user.greeting());  // "Welcome back, alice!"
    println!("{}", user.farewell());  // "Goodbye, alice!"
}
```

## Generic Functions

Generics let you write a single function that works with multiple types. The compiler generates specialized code for each concrete type (monomorphization), so there is no runtime cost.

```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    // Note: this panics on an empty slice. A more robust version
    // would return Option<&T> and handle the empty case.
    let mut largest = &list[0];
    for item in &list[1..] {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn main() {
    let numbers = vec![34, 50, 25, 100, 65];
    println!("Largest number: {}", largest(&numbers));

    let chars = vec!['y', 'm', 'a', 'q'];
    println!("Largest char: {}", largest(&chars));
}
```

The `T: PartialOrd` part is a **trait bound** -- it says "T can be any type, as long as it implements `PartialOrd`."

## Generic Structs and Enums

You can define structs and enums that are generic over one or more types.

```rust
#[derive(Debug)]
struct Pair<T, U> {
    first: T,
    second: U,
}

impl<T, U> Pair<T, U> {
    fn new(first: T, second: U) -> Self {
        Pair { first, second }
    }

    fn swap(self) -> Pair<U, T> {
        Pair {
            first: self.second,
            second: self.first,
        }
    }
}

// You can add methods only for specific type combinations
impl<T: std::fmt::Display, U: std::fmt::Display> Pair<T, U> {
    fn show(&self) {
        println!("({}, {})", self.first, self.second);
    }
}

fn main() {
    let pair = Pair::new("hello", 42);
    pair.show();

    let swapped = pair.swap();
    swapped.show();
}
```

## Trait Bounds and `where` Clauses

When trait bounds get complex, `where` clauses make them more readable.

```rust
use std::fmt::{Display, Debug};

// This is hard to read with inline bounds
// fn process<T: Display + Clone + Debug, U: Clone + Debug>(t: T, u: U) -> String {

// where clause is cleaner
fn process<T, U>(t: T, u: U) -> String
where
    T: Display + Clone + Debug,
    U: Clone + Debug,
{
    let t_clone = t.clone();
    println!("Debug t: {:?}, u: {:?}", t_clone, u.clone());
    format!("Display t: {}", t)
}

fn main() {
    let result = process("hello", vec![1, 2, 3]);
    println!("{}", result);
}
```

## `impl Trait` Syntax

`impl Trait` provides a concise way to work with traits in function signatures.

```rust
// As a parameter: accepts any type implementing Display
fn print_it(item: &impl std::fmt::Display) {
    println!("{}", item);
}

// As a return type: returns some type implementing the trait
fn create_message() -> impl std::fmt::Display {
    String::from("This is a message")
}

// Useful for returning closures
fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    move |y| x + y
}

fn main() {
    print_it(&"hello");
    print_it(&create_message());

    let add_five = make_adder(5);
    println!("5 + 3 = {}", add_five(3));
}
```

## Trait Objects and Dynamic Dispatch

Sometimes you need a collection of different types that all implement the same trait. Since each type has a different size, you cannot store them directly in a `Vec<T>`. Instead, use `Box<dyn Trait>` for dynamic dispatch.

```rust
trait Animal {
    fn speak(&self) -> &str;
    fn name(&self) -> &str;
}

struct Dog { name: String }
struct Cat { name: String }

impl Animal for Dog {
    fn speak(&self) -> &str { "Woof!" }
    fn name(&self) -> &str { &self.name }
}

impl Animal for Cat {
    fn speak(&self) -> &str { "Meow!" }
    fn name(&self) -> &str { &self.name }
}

fn main() {
    // Box<dyn Animal> stores any type implementing Animal on the heap.
    // Method calls go through a vtable (virtual dispatch) at runtime.
    let animals: Vec<Box<dyn Animal>> = vec![
        Box::new(Dog { name: String::from("Rex") }),
        Box::new(Cat { name: String::from("Whiskers") }),
        Box::new(Dog { name: String::from("Buddy") }),
    ];

    for animal in &animals {
        println!("{} says {}", animal.name(), animal.speak());
    }
}
```

Use generics (static dispatch) when you know the concrete type at compile time -- it is faster because the compiler inlines the calls. Use `dyn Trait` (dynamic dispatch) when you need to store or work with mixed types at runtime.

## Common Standard Library Traits

Rust's standard library defines many traits that you will implement and use regularly.

```rust
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
struct Color {
    r: u8,
    g: u8,
    b: u8,
}

// Display: user-facing string representation
impl fmt::Display for Color {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "#{:02x}{:02x}{:02x}", self.r, self.g, self.b)
    }
}

fn main() {
    let red = Color { r: 255, g: 0, b: 0 };
    let also_red = red.clone(); // Clone trait

    println!("Debug: {:?}", red);   // Debug trait
    println!("Display: {}", red);   // Display trait
    println!("Equal: {}", red == also_red); // PartialEq trait
}
```

## `From` and `Into` Conversions

The `From` and `Into` traits are used for type conversions. Implementing `From` automatically gives you `Into` for free.

```rust
struct Celsius(f64);
struct Fahrenheit(f64);

impl From<Celsius> for Fahrenheit {
    fn from(c: Celsius) -> Self {
        Fahrenheit(c.0 * 9.0 / 5.0 + 32.0)
    }
}

impl From<Fahrenheit> for Celsius {
    fn from(f: Fahrenheit) -> Self {
        Celsius((f.0 - 32.0) * 5.0 / 9.0)
    }
}

fn main() {
    let boiling = Celsius(100.0);
    let boiling_f: Fahrenheit = boiling.into(); // uses Into (from From)
    println!("100C = {}F", boiling_f.0);

    let body_temp = Fahrenheit(98.6);
    let body_temp_c = Celsius::from(body_temp); // uses From directly
    println!("98.6F = {:.1}C", body_temp_c.0);

    // From<&str> for String is why this works:
    let s: String = String::from("hello");
    let s2: String = "world".into();
    println!("{} {}", s, s2);
}
```

## Implementing `Iterator`

The `Iterator` trait is one of the most powerful traits in Rust. Implementing it gives you access to dozens of adaptor methods for free.

```rust
struct Countdown {
    value: u32,
}

impl Countdown {
    fn new(start: u32) -> Self {
        Countdown { value: start }
    }
}

impl Iterator for Countdown {
    type Item = u32; // Associated type

    fn next(&mut self) -> Option<Self::Item> {
        if self.value == 0 {
            None
        } else {
            let current = self.value;
            self.value -= 1;
            Some(current)
        }
    }
}

fn main() {
    // All these methods come free from implementing next()
    let countdown = Countdown::new(5);
    let doubled: Vec<u32> = countdown.map(|n| n * 2).collect();
    println!("Doubled: {:?}", doubled);

    let sum: u32 = Countdown::new(10).sum();
    println!("Sum 1..10: {}", sum);

    let evens: Vec<u32> = Countdown::new(10).filter(|n| n % 2 == 0).collect();
    println!("Evens: {:?}", evens);
}
```

## Practice

1. Define a `Shape` trait with an `area(&self) -> f64` method. Implement it for `Circle` and `Rectangle` structs.
2. Write a generic function `print_all<T: Display>(items: &[T])` that prints each item on a new line.
3. Implement `From<(f64, f64)>` for a `Point` struct.
4. Create a `Vec<Box<dyn Shape>>` with mixed shapes and print all their areas.

Try these and more at [Rust exercises](/tracks/rust).

## What's Next?

With traits and generics in your toolkit, you can write highly reusable and type-safe code. Next up: [Fearless Concurrency](/tutorials/rust-fearless-concurrency), where you will learn how Rust's type system prevents data races at compile time.
