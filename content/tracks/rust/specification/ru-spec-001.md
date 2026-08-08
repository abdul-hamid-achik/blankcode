---
slug: ru-spec-001
title: 'Pin it down: the cases that make a duration formatter unambiguous'
description: Five implementations of format_duration. One is right and four skip a sentence each — and all five agree on the demo value. Write the cases that tell them apart.
difficulty: intermediate
type: challenge
hints:
  - Each wrong implementation ignores exactly one sentence. One input per sentence is the whole method.
  - 4953 seconds satisfies every implementation. The disagreements live at zero, at round hours, under a minute, and past a day.
  - Your expected values must be right too — the correct implementation has to pass every case you write.
tags:
  - specification
  - testing
  - formatting
---

Ask for "format seconds as h/m/s" and you will get something that turns
`4953` into `1h 22m 33s`. It will also do *something* with `0`, with
`3600`, and with `62` — and each of those somethings is a decision somebody
made without telling you.

Here is the description, stated properly:

> `format_duration(secs)` renders a duration for humans. Units are `h`,
> `m`, `s`, space-separated. A unit with a zero value is omitted — except
> that a zero duration renders as `"0s"`, never as an empty string. Values
> are not zero-padded. The largest unit is hours; hours may exceed 24.

Below are five implementations. One satisfies that description. Four
satisfy a reading of it that skips one sentence — and all five agree on
`4953`.

**Your job is not to write `format_duration`.** It is to write the cases
that accept the correct implementation and reject each of the other four.

```rust
/// One input pinned to the output the description requires.
pub struct Case {
    pub secs: u64,
    pub expected: &'static str,
}

/// The cases that pin the description down.
///
/// To pass, this list must accept the correct implementation and reject
/// each of the four wrong ones. A case whose expected value is not what the
/// description requires will fail against the correct implementation, so
/// getting the values right is part of the exercise.
pub fn cases() -> Vec<Case> {
    vec![
        // Your cases here
    ]
}
```

## Tests

```rust
// Satisfies every sentence of the description.
fn correct(secs: u64) -> String {
    if secs == 0 {
        return "0s".to_string();
    }
    let (h, m, s) = (secs / 3600, (secs % 3600) / 60, secs % 60);
    let mut parts = Vec::new();
    if h > 0 {
        parts.push(format!("{h}h"));
    }
    if m > 0 {
        parts.push(format!("{m}m"));
    }
    if s > 0 {
        parts.push(format!("{s}s"));
    }
    parts.join(" ")
}

// Skips "a zero duration renders as 0s": returns the empty string.
fn empty_at_zero(secs: u64) -> String {
    let (h, m, s) = (secs / 3600, (secs % 3600) / 60, secs % 60);
    let mut parts = Vec::new();
    if h > 0 {
        parts.push(format!("{h}h"));
    }
    if m > 0 {
        parts.push(format!("{m}m"));
    }
    if s > 0 {
        parts.push(format!("{s}s"));
    }
    parts.join(" ")
}

// Skips "a unit with a zero value is omitted": renders every unit, always.
fn keeps_zero_units(secs: u64) -> String {
    let (h, m, s) = (secs / 3600, (secs % 3600) / 60, secs % 60);
    format!("{h}h {m}m {s}s")
}

// Skips "values are not zero-padded": pads minutes and seconds to two
// digits, clock-style.
fn zero_pads(secs: u64) -> String {
    if secs == 0 {
        return "0s".to_string();
    }
    let (h, m, s) = (secs / 3600, (secs % 3600) / 60, secs % 60);
    let mut parts = Vec::new();
    if h > 0 {
        parts.push(format!("{h}h"));
    }
    if m > 0 {
        parts.push(format!("{m:02}m"));
    }
    if s > 0 {
        parts.push(format!("{s:02}s"));
    }
    parts.join(" ")
}

// Skips "the largest unit is hours": rolls hours past 24 into days.
fn rolls_into_days(secs: u64) -> String {
    if secs == 0 {
        return "0s".to_string();
    }
    let (d, h, m, s) = (
        secs / 86400,
        (secs % 86400) / 3600,
        (secs % 3600) / 60,
        secs % 60,
    );
    let mut parts = Vec::new();
    if d > 0 {
        parts.push(format!("{d}d"));
    }
    if h > 0 {
        parts.push(format!("{h}h"));
    }
    if m > 0 {
        parts.push(format!("{m}m"));
    }
    if s > 0 {
        parts.push(format!("{s}s"));
    }
    parts.join(" ")
}

fn survives(format: fn(u64) -> String) -> bool {
    cases().iter().all(|c| format(c.secs) == c.expected)
}

#[test]
fn cases_exist() {
    assert!(!cases().is_empty(), "write at least one case");
}

#[test]
fn cases_are_correct() {
    // Every expected value has to be what the description actually
    // requires. A case built around a guess rejects the right
    // implementation.
    for c in cases() {
        assert_eq!(
            correct(c.secs),
            c.expected,
            "case for {} expects the wrong value",
            c.secs
        );
    }
}

#[test]
fn accept_the_correct_implementation() {
    assert!(survives(correct));
}

#[test]
fn reject_empty_at_zero() {
    assert!(!survives(empty_at_zero), "the zero-duration sentence is untested");
}

#[test]
fn reject_keeping_zero_units() {
    assert!(!survives(keeps_zero_units), "the omit-zero-units sentence is untested");
}

#[test]
fn reject_zero_padding() {
    assert!(!survives(zero_pads), "the no-padding sentence is untested");
}

#[test]
fn reject_rolling_into_days() {
    assert!(!survives(rolls_into_days), "the hours-are-largest sentence is untested");
}

#[test]
fn not_by_volume() {
    // Four wrong implementations need at most four inputs to expose.
    assert!(cases().len() <= 12, "a specification this small pins down in far fewer");
}

#[test]
fn no_duplicate_inputs() {
    let mut secs: Vec<u64> = cases().iter().map(|c| c.secs).collect();
    secs.sort_unstable();
    let before = secs.len();
    secs.dedup();
    assert_eq!(before, secs.len(), "duplicate inputs");
}
```

## Solution

```rust
/// One input pinned to the output the description requires.
pub struct Case {
    pub secs: u64,
    pub expected: &'static str,
}

/// Four wrong implementations, four sentences, one case aimed at each —
/// plus the baseline everyone agrees on. 4953 is deliberately the least
/// interesting input here — every value two digits, nothing zero, under a
/// day: agreement on the easy value is what hides the disagreements until
/// production.
pub fn cases() -> Vec<Case> {
    vec![
        // The baseline all five get right.
        Case { secs: 4953, expected: "1h 22m 33s" },
        // Zero: "0s", never "". The all-units renderer also fails here
        // ("0h 0m 0s"), but it earns its own case below.
        Case { secs: 0, expected: "0s" },
        // A round hour omits BOTH zero units — the case aimed at the
        // renderer that keeps them.
        Case { secs: 3600, expected: "1h" },
        // Padding shows only when a unit is single-digit next to another:
        // 62s is "1m 2s", and the clock-style reading writes "1m 02s".
        Case { secs: 62, expected: "1m 2s" },
        // Hours past a day stay hours: 90000s is "25h", not "1d 1h".
        Case { secs: 90_000, expected: "25h" },
    ]
}
```
