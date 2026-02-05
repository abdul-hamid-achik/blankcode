---
slug: rust-ownership-and-borrowing-001
title: Understanding Ownership Transfer
description: Learn how ownership moves between variables in Rust and when values become invalid
difficulty: beginner
hints:
  - When you assign a variable to another, ownership transfers for heap-allocated types
  - After ownership moves, the original variable can no longer be used
  - You can clone data to create a new owned copy
  - String is a heap-allocated type, so it moves rather than copies
tags:
  - ownership
  - move-semantics
  - strings
  - clone
---

In Rust, each value has a single owner. When you assign a heap-allocated value to a new variable, ownership **moves** to the new variable. The original variable becomes invalid.

Complete the code below to demonstrate ownership transfer and fix compilation errors:

```rust
fn main() {
    // Create a String (heap-allocated)
    let s1 = String::from("hello");
    
    // Ownership moves from s1 to s2
    let s2 = ___blank_start___s1___blank_end___;
    
    // This would cause an error because s1 no longer owns the data
    // println!("{}", s1); // ❌ ERROR!
    
    // s2 is valid and owns the string
    println!("{}", s2);
    
    // To use both variables, we need to clone
    let s3 = String::from("world");
    let s4 = ___blank_start___s3.clone()___blank_end___;
    
    // Now both s3 and s4 are valid
    println!("{} {}", s3, s4);
    
    // Functions also take ownership
    take_ownership(s2);
    
    // s2 is no longer valid here
    // println!("{}", s2); // ❌ ERROR!
    
    // To keep using a value after passing it, return it
    let s5 = String::from("rust");
    let s5 = ___blank_start___give_and_take_ownership(s5)___blank_end___;
    
    // s5 is valid because ownership was returned
    println!("{}", s5);
}

fn take_ownership(s: String) {
    println!("Taking ownership of: {}", s);
    // s goes out of scope and is dropped here
}

fn give_and_take_ownership(s: String) -> String {
    println!("Processing: {}", s);
    ___blank_start___s___blank_end___ // Return ownership back to caller
}
```

## Tests

```rust
#[test]
fn ownership_moves_and_clones() {
    let s1 = String::from("hello");
    let s2 = s1;
    assert_eq!(s2, "hello");

    let s3 = String::from("world");
    let s4 = s3.clone();
    assert_eq!(s3, "world");
    assert_eq!(s4, "world");
}

#[test]
fn ownership_is_returned() {
    let s5 = String::from("rust");
    let s5 = give_and_take_ownership(s5);
    assert_eq!(s5, "rust");
}
```
