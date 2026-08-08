---
slug: ru-review-001
title: 'Review: a leaderboard that panics on one bad float'
description: The top-scores helper below passes its tests. One NaN anywhere in the input and it panics in production. Find the unwrap that was never safe.
difficulty: intermediate
type: review
hints:
  - The spec says NaN entries are skipped. Search the implementation for where a NaN could even be looked at.
  - partial_cmp exists because floats are only partially ordered. What does it return for NaN, and what does the code do with that?
  - Filtering bad values first makes the ordering question disappear entirely.
tags:
  - code-review
  - floats
  - panics
---

You asked a model for a leaderboard helper: the top `n` scores, highest first.
The spec had one hedge in it, because score data comes from a parser and
parsers produce garbage:

> Entries that are NaN are skipped, never returned, and never crash the
> function.

It produced this, with tests. The tests pass — every score in them is a clean,
well-behaved float.

One NaN in the input and the whole thing panics. `partial_cmp` returns an
`Option` precisely because floats are not totally ordered, and the generated
code answered that inconvenience with `.unwrap()` — the compiler stopped
asking, so it looked handled. This is the most common way a float panic
reaches production in Rust: not arithmetic, but sorting.

Find the defect and fix it. You are graded on tests you cannot see.

```rust
/// Returns the top `n` scores, highest first. NaN entries are skipped,
/// never returned, and never crash the function.
pub fn top_scores(scores: &[f64], n: usize) -> Vec<f64> {
    let mut sorted: Vec<f64> = scores.to_vec();
    sorted.sort_by(|a, b| b.partial_cmp(a).unwrap());
    sorted.truncate(n);
    sorted
}
```

## The tests it came with

These all pass. No score in them is NaN, which is the only reason they can.

```rust
#[test]
fn returns_top_three() {
    let scores = [10.0, 50.0, 30.0, 20.0];
    assert_eq!(top_scores(&scores, 3), vec![50.0, 30.0, 20.0]);
}

#[test]
fn fewer_scores_than_n() {
    let scores = [1.0, 2.0];
    assert_eq!(top_scores(&scores, 5), vec![2.0, 1.0]);
}

#[test]
fn empty_input() {
    let scores: [f64; 0] = [];
    assert_eq!(top_scores(&scores, 3), Vec::<f64>::new());
}
```

## Tests

```rust
#[test]
fn returns_top_three() {
    let scores = [10.0, 50.0, 30.0, 20.0];
    assert_eq!(top_scores(&scores, 3), vec![50.0, 30.0, 20.0]);
}

#[test]
fn fewer_scores_than_n() {
    let scores = [1.0, 2.0];
    assert_eq!(top_scores(&scores, 5), vec![2.0, 1.0]);
}

#[test]
fn empty_input() {
    let scores: [f64; 0] = [];
    assert_eq!(top_scores(&scores, 3), Vec::<f64>::new());
}

#[test]
fn nan_does_not_panic() {
    let scores = [10.0, f64::NAN, 30.0];
    let top = top_scores(&scores, 3);
    assert_eq!(top, vec![30.0, 10.0]);
}

#[test]
fn nan_is_never_returned() {
    let scores = [f64::NAN, 5.0, f64::NAN, 1.0];
    let top = top_scores(&scores, 4);
    assert_eq!(top.len(), 2);
    assert!(top.iter().all(|s| !s.is_nan()));
}

#[test]
fn all_nan_returns_empty() {
    let scores = [f64::NAN, f64::NAN];
    assert_eq!(top_scores(&scores, 2), Vec::<f64>::new());
}

#[test]
fn zero_n_returns_empty() {
    let scores = [1.0, 2.0];
    assert_eq!(top_scores(&scores, 0), Vec::<f64>::new());
}
```

## Solution

```rust
/// Returns the top `n` scores, highest first. NaN entries are skipped,
/// never returned, and never crash the function.
pub fn top_scores(scores: &[f64], n: usize) -> Vec<f64> {
    // The original called `partial_cmp(..).unwrap()` inside the comparator.
    // partial_cmp returns None exactly when one side is NaN — the Option is
    // the type system telling you floats are not totally ordered — and
    // unwrap turned that answer into a panic at the first bad value.
    //
    // Filtering NaN out first honors the spec AND makes the remaining values
    // totally ordered, so total_cmp finishes the job without a single
    // fallible branch.
    let mut sorted: Vec<f64> = scores.iter().copied().filter(|s| !s.is_nan()).collect();
    sorted.sort_by(|a, b| b.total_cmp(a));
    sorted.truncate(n);
    sorted
}
```
