---
title: "Traits and Generics"
slug: "rust-traits-and-generics"
description: "Shared behavior without inheritance and reusable code without runtime cost: traits, generics, monomorphization, and when dynamic dispatch is worth paying for."
track: "rust"
order: 3
difficulty: "intermediate"
tags: ["traits", "generics", "trait-bounds", "iterator", "dynamic-dispatch"]
practice:
  concept: "traits-and-generics"
  label: "Traits and generics"
---

A trait describes what a type can do. A generic function describes an algorithm that does not care which type it operates on, as long as that type does what a trait promises. Together they are how Rust gets polymorphism without inheritance, and without paying for it at runtime unless you explicitly ask for that tradeoff.

## Traits: shared behavior, not shared data

A trait is a set of method signatures a type commits to implementing. There is no data in a trait itself, only behavior — the core difference from inheritance in an object-oriented language. A trait cannot be instantiated on its own, and a type can implement any number of unrelated traits without an inheritance hierarchy forcing them into one tree.

```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct Tweet {
    username: String,
    text: String,
}

impl Summary for Tweet {
    fn summarize(&self) -> String {
        format!("@{}: {}", self.username, self.text)
    }
}
```

A trait method can carry a default body; implementors override only what differs.

```rust
trait Greet {
    fn name(&self) -> &str;

    fn greeting(&self) -> String {
        format!("Hello, {}", self.name())
    }
}
```

Default methods are how the standard library ships behavior like `Iterator::map` or `Iterator::filter` on top of a single method you implement — more on that below.

## Generic functions and monomorphization

A generic function is written once against a type parameter and compiled once per concrete type it is actually called with — a process called monomorphization. `largest::<i32>` and `largest::<char>` are, after compilation, two entirely separate functions. There is no vtable, no runtime type check, no cost beyond what a hand-written version for each type would have had.

```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in &list[1..] {
        if item > largest {
            largest = item;
        }
    }
    largest
}
```

`T: PartialOrd` is a trait bound: `T` can be any type, as long as it implements `PartialOrd`. Without it, `item > largest` would not compile, because the compiler has no idea whether an arbitrary `T` supports `>` at all. When bounds pile up, a `where` clause keeps the signature readable:

```rust
fn process<T, U>(t: T, u: U) -> String
where
    T: std::fmt::Display + Clone,
    U: std::fmt::Debug,
{
    format!("{} {:?}", t.clone(), u)
}
```

Monomorphization is also the tradeoff worth knowing: each instantiation is separately compiled code, so a generic function called with twenty different types produces twenty copies in the binary. That is the right cost to pay for hot-path code. It is the wrong one for something like a plugin registry with dozens of implementors, which is where dynamic dispatch below becomes the better choice, not merely an alternative style.

::code-blank{lang="rust" href="/tracks/rust/traits-and-generics" label="practice traits and generics for real"}
---
code: |
  fn process<T, U>(t: T, u: U) -> String
  ___blank_start___where___blank_end___
      T: std::fmt::Display,
  {
      format!("{}", t)
  }
---
::

## Static vs dynamic dispatch

Generics give you static dispatch: the compiler knows the concrete type at every call site and can inline through it. Sometimes you need the opposite — a single `Vec` holding several different types that all implement the same trait, decided at runtime, like a list of event handlers registered from different modules. Rust cannot store values of different sizes directly in a `Vec<T>`, so you box them and drop down to a trait object, `Box<dyn Trait>`.

```rust
trait Animal {
    fn speak(&self) -> &str;
}

struct Dog;
struct Cat;

impl Animal for Dog {
    fn speak(&self) -> &str { "Woof" }
}
impl Animal for Cat {
    fn speak(&self) -> &str { "Meow" }
}

fn main() {
    let animals: Vec<Box<dyn Animal>> = vec![Box::new(Dog), Box::new(Cat)];
    for a in &animals {
        println!("{}", a.speak());
    }
}
```

Each call through `dyn Animal` goes through a vtable lookup instead of being inlined — real cost, usually negligible. Default to generics; reach for `dyn Trait` when the set of concrete types is not known until runtime, not as a habitual way to avoid writing `<T: Trait>`. `impl Trait` in a parameter position is sugar for a generic with one bound and is still static dispatch; in return position it is how you return a closure or an unnameable type like an iterator-adaptor chain without spelling out its type.

::code-blank{lang="rust" href="/tracks/rust/traits-and-generics" label="practice traits and generics for real"}
---
code: |
  let animals: Vec<Box<___blank_start___dyn___blank_end___ Animal>> = vec![Box::new(Dog)];
---
::

## Implementing `Iterator`

`Iterator` is a trait worth knowing well because implementing a single required method — `next`, returning `Option<Self::Item>` — earns you dozens of default methods for free: `map`, `filter`, `sum`, `take`, `zip`, and more, all built on repeated calls to `next`. This is the same default-method mechanism from the `Greet` example above, used at a much larger scale by the standard library itself.

```rust
struct Countdown { value: u32 }

impl Iterator for Countdown {
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.value == 0 {
            None
        } else {
            self.value -= 1;
            Some(self.value + 1)
        }
    }
}

fn main() {
    let doubled: Vec<u32> = Countdown { value: 5 }.map(|n| n * 2).collect();
    println!("{:?}", doubled);
}
```

`type Item = u32;` is an associated type: a type chosen once per implementation, rather than a generic parameter chosen per call. The difference matters — a type can implement `Iterator` for exactly one `Item`, but it can implement `From<T>` for many different `T`s, because `From` uses a generic parameter instead of an associated type. Reach for an associated type when an implementation has exactly one sensible choice; reach for a generic parameter when it has several.

::code-blank{lang="rust" href="/tracks/rust/traits-and-generics" label="practice traits and generics for real"}
---
code: |
  impl Iterator for Countdown {
      type ___blank_start___Item___blank_end___ = u32;

      fn next(&mut self) -> Option<Self::Item> {
          None
      }
  }
---
::

## Where this bites

**Reaching for `dyn Trait` by default.** It is the right call when concrete types genuinely are not known until runtime; used as a habit, it trades away monomorphization's inlining and adds a vtable indirection for no reason. Start with a generic and switch to `dyn` only once you actually need to mix types in one collection.

**Fighting the orphan rule.** You can implement a trait for a type only if you own the trait or the type — `impl Display for Vec<T>` from your own crate will not compile, because neither `Display` nor `Vec` is yours. Wrap the foreign type in a local tuple struct, the newtype pattern, and implement the trait for the wrapper instead.

**Confusing a `Clone` bound with a cheap operation.** A generic function with a `T: Clone` bound compiles for any `T`, including a type whose clone is a deep copy of a ten-megabyte buffer. A bound tells you the operation is possible, not that it is free — check what `Clone` actually costs for the type you are calling it on before assuming a generic function is cheap.

**Expecting `impl Trait` in return position to allow different types across branches.** `if cond { A } else { B }` does not compile even when both implement the same trait, because `impl Trait` commits the function to one concrete, compiler-chosen type. Use `Box<dyn Trait>` when a function genuinely needs to return different concrete types depending on a runtime condition.
