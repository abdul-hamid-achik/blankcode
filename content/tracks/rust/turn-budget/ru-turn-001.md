---
slug: ru-turn-001
title: 'Three messages: a coordinate parser that counts its commas'
description: Get a model to write parse_pair in three messages. The hidden suite cares about whitespace, extra commas, and overflow — the three things a first message never mentions.
difficulty: intermediate
type: turn
turnBudget: 3
hints:
  - '"3, 4" with a space is the input every human types and no first message specifies. Decide: tolerated or rejected?'
  - What should "1,2,3" do? A model that splits and takes the first two will never tell you it discarded the third.
  - Ask the model what its code does with "99999999999999999999,0" — then check whether you believe it.
tags:
  - ai
  - prompting
  - parsing
---

Write `parse_pair`, using a model, in **three messages**.

> `parse_pair(input)` parses `"3,4"` into `Ok((3, 4))`. Whitespace around
> either number is tolerated: `" 3 , 4 "` parses. Anything else is `Err`:
> more or fewer than two fields, empty fields, non-numeric fields, or a
> number that does not fit in `i32`. The error is a `String`; its content is
> yours, but it must exist.

That is the whole specification. The generous mistakes live at its edges: a
model told "parse comma-separated integers" will happily `split(',')` and
take the first two fields, silently discarding a third — and `"1,2,3"`
becoming `(1, 2)` is a coordinate bug you find in production, not in review.
Overflow is the other silent guess: `parse::<i32>()` already refuses it, but
only if nobody `unwrap`s the refusal away.

**The suite you are graded against is hidden until you submit.** You cannot
paste it to the model; if you could, the skill being practised would be
pasting.

You have three messages and you do not have to use them. Submitting with a
turn in hand is a better result, and the report says which happened.

```rust
/// Parses "3,4" (whitespace tolerated) into Ok((3, 4)).
///
/// Write this with the model. When you are satisfied, submit — the hidden
/// suite runs against whatever is in here.
pub fn parse_pair(input: &str) -> Result<(i32, i32), String> {
    Err(format!("not implemented: {input}"))
}
```

## Tests

```rust
#[test]
fn parses_a_plain_pair() {
    assert_eq!(parse_pair("3,4"), Ok((3, 4)));
}

#[test]
fn tolerates_whitespace() {
    assert_eq!(parse_pair(" 3 , 4 "), Ok((3, 4)));
}

#[test]
fn parses_negative_numbers() {
    assert_eq!(parse_pair("-7,42"), Ok((-7, 42)));
}

#[test]
fn rejects_a_third_field() {
    // The silent discard: split-and-take-two turns "1,2,3" into (1, 2)
    // without a word. Two fields exactly, or an error.
    assert!(parse_pair("1,2,3").is_err());
}

#[test]
fn rejects_a_single_field() {
    assert!(parse_pair("42").is_err());
}

#[test]
fn rejects_empty_fields() {
    assert!(parse_pair("3,").is_err());
    assert!(parse_pair(",4").is_err());
}

#[test]
fn rejects_an_empty_string() {
    assert!(parse_pair("").is_err());
}

#[test]
fn rejects_non_numeric_fields() {
    assert!(parse_pair("a,4").is_err());
}

#[test]
fn rejects_overflow_instead_of_panicking() {
    // parse::<i32> already says no; the exercise is not unwrapping the no.
    assert!(parse_pair("99999999999999999999,0").is_err());
}

#[test]
fn accepts_i32_boundaries() {
    assert_eq!(parse_pair("-2147483648,2147483647"), Ok((i32::MIN, i32::MAX)));
}
```

## Solution

```rust
/// Parses "3,4" (whitespace tolerated) into Ok((3, 4)).
pub fn parse_pair(input: &str) -> Result<(i32, i32), String> {
    /*
     * The clauses that decide this exercise:
     *
     * - exactly two fields. collect::<Vec<_>>() and a length check refuses
     *   "1,2,3" outright, where the generous split-and-take-two silently
     *   throws the third coordinate away;
     * - whitespace tolerance is trim() per FIELD, not on the whole input —
     *   " 3 , 4 " has spaces the outer trim cannot reach;
     * - overflow is already an error inside parse::<i32>(); map_err keeps
     *   it one instead of unwrapping it into a panic.
     */
    let fields: Vec<&str> = input.split(',').collect();
    if fields.len() != 2 {
        return Err(format!("expected two fields, got {}", fields.len()));
    }

    let parse = |field: &str| -> Result<i32, String> {
        field
            .trim()
            .parse::<i32>()
            .map_err(|e| format!("bad field {field:?}: {e}"))
    };

    Ok((parse(fields[0])?, parse(fields[1])?))
}
```
