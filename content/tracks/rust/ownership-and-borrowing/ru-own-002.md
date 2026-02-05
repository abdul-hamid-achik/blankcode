---
slug: rust-ownership-and-borrowing-string-moves
title: Understanding String Ownership and Moves
description: Learn how ownership works in Rust by completing a function that demonstrates moving and borrowing String values
difficulty: beginner
hints:
  - When you assign a String to another variable, ownership is transferred (moved)
  - Use the `clone()` method to create a deep copy if you need to keep the original
  - Borrowing with `&` lets you use a value without taking ownership
  - After a value is moved, the original variable can no longer be used
tags:
  - ownership
  - borrowing
  - strings
  - moves
---

In this exercise, you'll complete a program that demonstrates Rust's ownership system. You need to:

1. Create a String and assign it to a variable
2. Transfer ownership to another variable using a move
3. Borrow a String reference instead of moving it
4. Clone a String to create an independent copy

Fill in the blanks to make the code compile and pass the tests.

```rust
fn main() {
    // Create a new String
    let s1 = String::from("Hello");
    
    // Move s1 to s2 (ownership transfer)
    let s2 = ___blank_start___s1___blank_end___;
    
    // s1 is no longer valid here, s2 owns the data
    println!("s2: {}", s2);
    
    // Create another String
    let s3 = String::from("World");
    
    // Borrow s3 instead of moving it
    let len = calculate_length(___blank_start___&s3___blank_end___);
    
    // s3 is still valid because we only borrowed it
    println!("s3: {}, length: {}", s3, len);
    
    // Clone s3 to create an independent copy
    let s4 = s3.___blank_start___clone()___blank_end___;
    
    // Both s3 and s4 are valid
    println!("s3: {}, s4: {}", s3, s4);
}

fn calculate_length(s: ___blank_start___&String___blank_end___) -> usize {
    s.len()
}
```

## Tests

```rust
#[test]
fn move_borrow_clone_flow() {
    let s1 = String::from("Hello");
    let s2 = s1;
    assert_eq!(s2, "Hello");

    let s3 = String::from("World");
    let len = calculate_length(&s3);
    assert_eq!(len, 5);
    let s4 = s3.clone();
    assert_eq!(s3, "World");
    assert_eq!(s4, "World");
}
```
