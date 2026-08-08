---
slug: ru-review-003
title: 'Review: a moving average that panics on the edges'
description: The moving-average helper below passes its tests on every reasonable input. The spec was specifically about the unreasonable ones. Two edge cases, two panics.
difficulty: advanced
type: review
hints:
  - The spec dedicates a full sentence to window sizes that make no sense. Count how many shipped tests exercise them.
  - What does slice::windows do when its argument is zero? The documentation is one sentence and it is the whole bug.
  - A window larger than the data has a defined answer here — empty — and the code never considers it. Guard first, then iterate.
tags:
  - code-review
  - slices
  - panics
---

You asked a model for a moving average over a series, and because input
arrives from a config file, the spec spelled out the nonsense cases:

> `moving_average(values, window)` returns the average of each consecutive
> `window` values. A window of zero, or one larger than the series, yields an
> empty vector — never a panic. This runs in a request handler.

It produced this, with tests. The tests pass — every one of them uses a
sensible window on a longer series.

Both named edge cases panic. `slice::windows` panics outright when its
argument is zero — the documentation says so in one sentence — and while an
oversized window is handled by `windows` itself (it yields nothing), this
implementation never gets there: it computes `values.len() - window + 1` on
unsigned integers first, and underflow panics in debug builds. Two guards
the spec asked for by name, both missing, both invisible to a suite that
only feeds the function sense.

Find the defect and fix it. You are graded on tests you cannot see.

```rust
/// The average of each consecutive `window` values. A window of zero, or
/// one larger than the series, yields an empty vector — never a panic.
pub fn moving_average(values: &[f64], window: usize) -> Vec<f64> {
    let count = values.len() - window + 1;
    let mut averages = Vec::with_capacity(count);
    for chunk in values.windows(window) {
        averages.push(chunk.iter().sum::<f64>() / window as f64);
    }
    averages
}
```

## The tests it came with

These all pass. Every window is between one and the series length — the
exact range the spec was not worried about.

```rust
#[test]
fn averages_pairs() {
    let result = moving_average(&[1.0, 2.0, 3.0, 4.0], 2);
    assert_eq!(result, vec![1.5, 2.5, 3.5]);
}

#[test]
fn window_of_one_is_identity() {
    let result = moving_average(&[5.0, 7.0], 1);
    assert_eq!(result, vec![5.0, 7.0]);
}

#[test]
fn window_equal_to_length() {
    let result = moving_average(&[2.0, 4.0], 2);
    assert_eq!(result, vec![3.0]);
}
```

## Tests

```rust
#[test]
fn averages_pairs() {
    let result = moving_average(&[1.0, 2.0, 3.0, 4.0], 2);
    assert_eq!(result, vec![1.5, 2.5, 3.5]);
}

#[test]
fn window_of_one_is_identity() {
    let result = moving_average(&[5.0, 7.0], 1);
    assert_eq!(result, vec![5.0, 7.0]);
}

#[test]
fn window_equal_to_length() {
    let result = moving_average(&[2.0, 4.0], 2);
    assert_eq!(result, vec![3.0]);
}

#[test]
fn zero_window_is_empty_not_a_panic() {
    // slice::windows(0) panics by documented contract; the spec says this
    // input yields an empty vector instead. The guard is the exercise.
    assert_eq!(moving_average(&[1.0, 2.0], 0), Vec::<f64>::new());
}

#[test]
fn oversized_window_is_empty_not_a_panic() {
    // len - window + 1 underflows on usize before windows() could even
    // answer correctly. In a request handler, that arithmetic is the outage.
    assert_eq!(moving_average(&[1.0, 2.0], 5), Vec::<f64>::new());
}

#[test]
fn empty_series_is_empty() {
    assert_eq!(moving_average(&[], 3), Vec::<f64>::new());
}

#[test]
fn averages_triples() {
    let result = moving_average(&[1.0, 2.0, 3.0, 4.0, 5.0], 3);
    assert_eq!(result, vec![2.0, 3.0, 4.0]);
}
```

## Solution

```rust
/// The average of each consecutive `window` values. A window of zero, or
/// one larger than the series, yields an empty vector — never a panic.
pub fn moving_average(values: &[f64], window: usize) -> Vec<f64> {
    // Two panics hid in the original, one per named edge case:
    // - windows(0) panics by documented contract, so zero must be answered
    //   before the iterator is ever constructed;
    // - values.len() - window + 1 underflows usize when the window exceeds
    //   the series, which panics in debug builds before windows() could
    //   yield its correct "nothing".
    // One guard clause covers both, and the capacity arithmetic below it
    // becomes safe as a consequence.
    if window == 0 || window > values.len() {
        return Vec::new();
    }

    let mut averages = Vec::with_capacity(values.len() - window + 1);
    for chunk in values.windows(window) {
        averages.push(chunk.iter().sum::<f64>() / window as f64);
    }
    averages
}
```
