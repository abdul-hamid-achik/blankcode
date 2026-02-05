---
slug: rust-traits-and-generics-shape-area
title: Generic Shape Area Calculator
description: Implement a generic trait for calculating areas of different shapes using Rust traits and generics
difficulty: beginner
hints:
  - Traits define shared behavior across different types
  - The `impl` keyword is used to implement a trait for a specific type
  - Generic functions use angle brackets `<T>` to specify type parameters
  - Trait bounds are specified with `T: TraitName` syntax
tags:
  - traits
  - generics
  - rust
  - polymorphism
---

In this exercise, you'll learn how to use traits and generics in Rust by implementing a shape area calculator. You'll define a `Shape` trait and implement it for different geometric shapes, then write a generic function that works with any type implementing the trait.

Your tasks:
1. Define a `Shape` trait with an `area()` method
2. Implement the trait for `Circle` and `Rectangle` structs
3. Create a generic function that prints the area of any shape

```rust
// Define a trait called Shape with a method that returns area as f64
trait ___blank_start___Shape___blank_end___ {
    fn area(&self) -> f64;
}

struct Circle {
    radius: f64,
}

struct Rectangle {
    width: f64,
    height: f64,
}

// Implement the Shape trait for Circle
___blank_start___impl Shape for Circle___blank_end___ {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }
}

// Implement the Shape trait for Rectangle
impl Shape for Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }
}

// Generic function that accepts any type that implements Shape
fn print_area___blank_start___<T: Shape>___blank_end___(shape: &T) {
    println!("Area: {}", shape.area());
}

// Alternative syntax using where clause
fn calculate_total_area<T, U>(shape1: &T, shape2: &U) -> f64
where
    T: Shape,
    ___blank_start___U: Shape___blank_end___,
{
    shape1.area() + shape2.area()
}

fn main() {
    let circle = Circle { radius: 5.0 };
    let rectangle = Rectangle { width: 4.0, height: 6.0 };
    
    print_area(&circle);
    print_area(&rectangle);
    
    let total = calculate_total_area(&circle, &rectangle);
    println!("Total area: {}", total);
}
```

## Tests

```rust
#[test]
fn circle_area_matches_pi() {
    let circle = Circle { radius: 5.0 };
    let expected = std::f64::consts::PI * 25.0;
    assert!((circle.area() - expected).abs() < 1e-6);
}

#[test]
fn rectangle_area_matches_product() {
    let rectangle = Rectangle { width: 4.0, height: 6.0 };
    assert_eq!(rectangle.area(), 24.0);
}

#[test]
fn total_area_matches_sum() {
    let circle = Circle { radius: 5.0 };
    let rectangle = Rectangle { width: 4.0, height: 6.0 };
    let total = calculate_total_area(&circle, &rectangle);
    assert!((total - (circle.area() + rectangle.area())).abs() < 1e-6);
}

#[test]
fn print_area_compiles() {
    let circle = Circle { radius: 1.0 };
    print_area(&circle);
}
```
