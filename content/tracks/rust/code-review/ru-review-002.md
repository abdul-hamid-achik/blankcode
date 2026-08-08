---
slug: ru-review-002
title: 'Review: a budget that explodes at zero'
description: The remaining-budget helper below passes its tests. The first user who overspends takes the service down with them. Find the subtraction that was never checked.
difficulty: beginner
type: review
hints:
  - The spec says overspending clamps to zero. Find the line where overspending actually arrives.
  - What does unsigned subtraction do in Rust when the result would be negative? The answer differs between debug and release, and both are wrong here.
  - The standard library has a family of methods for exactly this. Their names start with what you want to happen.
tags:
  - code-review
  - integers
  - overflow
---

You asked a model for the smallest possible helper: how much of a usage budget
is left. The spec covered the one interesting case:

> If more than the budget has been spent, the remaining amount is 0 — never
> negative, never an error.

It produced this, with tests. The tests pass — every one of them spends less
than the budget.

The first caller who overspends panics the thread. `total - spent` on unsigned
integers panics on underflow in debug builds, and in release builds silently
wraps to a number a little under eighteen quintillion — which a billing page
will happily display. The generated tests never crossed the boundary the spec
was specifically about, so the suite proves the easy half and skips the half
that was the point.

Find the defect and fix it. You are graded on tests you cannot see.

```rust
/// Returns how much of `total` remains after `spent` has been used.
/// If more than the budget has been spent, the remaining amount is 0.
pub fn remaining_budget(total: u64, spent: u64) -> u64 {
    total - spent
}
```

## The tests it came with

These all pass. None of them spends past the budget — the exact case the spec
called out.

```rust
#[test]
fn nothing_spent() {
    assert_eq!(remaining_budget(100, 0), 100);
}

#[test]
fn partially_spent() {
    assert_eq!(remaining_budget(100, 40), 60);
}

#[test]
fn exactly_spent() {
    assert_eq!(remaining_budget(100, 100), 0);
}
```

## Tests

```rust
#[test]
fn nothing_spent() {
    assert_eq!(remaining_budget(100, 0), 100);
}

#[test]
fn partially_spent() {
    assert_eq!(remaining_budget(100, 40), 60);
}

#[test]
fn exactly_spent() {
    assert_eq!(remaining_budget(100, 100), 0);
}

#[test]
fn overspent_clamps_to_zero() {
    assert_eq!(remaining_budget(100, 150), 0);
}

#[test]
fn overspent_by_one_clamps_to_zero() {
    // The boundary itself: one past the budget must already be safe.
    assert_eq!(remaining_budget(100, 101), 0);
}

#[test]
fn zero_budget_with_spending() {
    assert_eq!(remaining_budget(0, 5), 0);
}
```

## Solution

```rust
/// Returns how much of `total` remains after `spent` has been used.
/// If more than the budget has been spent, the remaining amount is 0.
pub fn remaining_budget(total: u64, spent: u64) -> u64 {
    // The original wrote `total - spent`. On u64 that panics on underflow in
    // debug builds and wraps to ~1.8e19 in release — so the failure mode was
    // either a crash or a comically wrong number, chosen by compiler flag.
    // saturating_sub is the spec, verbatim: subtraction that stops at zero.
    total.saturating_sub(spent)
}
```
