---
slug: ru-context-001
title: 'Give it what it needs: an error enum it has never seen'
description: A model asked to return the right error will invent a variant — NotFound, the name every crate would use. This crate used another, with a field. One source states it.
difficulty: intermediate
type: context
hints:
  - The question needs one variant name and its shape. Which source is the enum itself, rather than prose about errors in general?
  - The RFC explains why the enum looks the way it does. Knowing why is not knowing what.
  - A struct variant with a named field cannot be guessed from its concept. That is why the answer has a price at all.
tags:
  - context
  - ai
  - cost
---

You are asking a model to write one return expression:

> In `load_key`, return the crate's error for an absent key, carrying the
> key's name.

It has never seen this crate. Left alone it will write
`Err(ConfigError::NotFound)` — the variant every crate *would* have, which
is what makes it a confident guess. This crate's variant is
`MissingKey { key }`, a struct variant with a named field, and the guess is
a compile error delivered after the explanation.

Four things could be shown to it. Each costs what it costs:

| source | tokens |
| --- | --- |
| The ConfigError enum | 180 |
| A caller that matches on it | 900 |
| The error-handling RFC | 2500 |
| The rendered rustdoc dump | 5000 |

Pick what to hand over, then write the expression. You are scored on being
right, and separately on what it cost.

```rust
/// The return expression, once you have decided what to hand over.
///
/// Write it as Rust source. It is checked for shape rather than compiled
/// against the real crate: the right variant with the right field — a name
/// you cannot know without the one source that states it.
pub const ANSWER: &str = "";
```

## Context

```yaml
required:
  - enum-definition
accept: '(?=[\s\S]*ConfigError)(?=[\s\S]*MissingKey)(?=[\s\S]*key)'
sources:
  - id: enum-definition
    label: The ConfigError enum
    tokens: 180
    content: |
      /// Everything loading a config can report.
      #[derive(Debug, PartialEq)]
      pub enum ConfigError {
          /// The file exists but a required key does not.
          MissingKey { key: String },
          /// The file could not be read at all.
          Unreadable { path: PathBuf },
          /// A key exists with a value of the wrong type.
          WrongType { key: String, expected: &'static str },
      }
  - id: caller
    label: A caller that matches on it
    tokens: 900
    content: |
      // startup.rs — nine hundred tokens of a match arm forest, retry
      // policy, and logging, in which the variant names appear once each …
  - id: rfc
    label: The error-handling RFC
    tokens: 2500
    content: |
      # RFC 007: errors carry what the handler needs

      We prefer struct variants with named fields over tuple variants …
      twenty-five hundred tokens of rationale that never lists the
      variants …
  - id: rustdoc
    label: The rendered rustdoc dump
    tokens: 5000
    content: |
      … five thousand tokens of rendered documentation for the whole
      crate, the enum somewhere in the middle …
```

## Tests

```rust
// This exercise is not graded by running the learner's code. It is graded
// by the context-selection service: what they chose, what it cost, and
// whether the answer was accepted.
//
// These tests keep the exercise's own definition honest — the definition is
// the thing that decides whether the exercise measures anything.

#[test]
fn reference_uses_the_real_variant() {
    assert!(ANSWER.contains("ConfigError"));
    assert!(ANSWER.contains("MissingKey"));
    assert!(ANSWER.contains("key"));
}

#[test]
fn reference_avoids_the_guessable_variant() {
    // NotFound is the variant every crate would have — the confident guess
    // this exercise exists to price.
    assert!(!ANSWER.contains("NotFound"));
    assert!(!ANSWER.contains("KeyMissing"));
}

#[test]
fn reference_is_an_err_expression() {
    assert!(ANSWER.trim_start().starts_with("Err("));
}
```

## Solution

```rust
/// The enum definition (180 tokens) is the only source that STATES the
/// variant and its shape — MissingKey { key }, a struct variant, not the
/// guessable NotFound. The caller contains it too at five times the price;
/// the RFC explains the shape without naming it; the rustdoc dump buries it
/// in the whole crate.
pub const ANSWER: &str = r#"Err(ConfigError::MissingKey { key: key.to_string() })"#;
```
