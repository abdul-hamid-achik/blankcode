---
slug: py-turn-001
title: 'Three messages: a slugify that survives truncation'
description: Get a model to write a slug function in three messages. The hidden suite checks the seams — collapsing separators and cutting to length — where every generated slugify quietly leaks hyphens.
difficulty: intermediate
type: turn
turnBudget: 3
hints:
  - '"Consecutive separators collapse" and "never starts or ends with a hyphen" are two different promises. State both, or the model will keep one and assume the other.'
  - Truncation is where the second promise gets broken. Ask what happens when the cut lands exactly on a hyphen.
  - Test what came back in your head with "Hello,   World!" and a max length of 6 before you spend another message.
tags:
  - ai
  - prompting
  - strings
---

Write `slugify`, using a model, in **three messages**.

> `slugify(title, max_length)` lowercases `title`, replaces every run of
> non-alphanumeric characters with a single hyphen, and cuts the result to at
> most `max_length` characters. The slug never starts or ends with a hyphen —
> including after the cut.

That is the whole specification. Its two promises interact, and the
interaction is what a first message tends to leave unsaid: truncation can land
exactly on a hyphen, and "never ends with a hyphen" still has to hold. A model
told only "cut to max_length" will slice and return whatever fell out —
`hello-` — and its example outputs will all look fine, because examples are
chosen to look fine.

**The suite you are graded against is hidden until you submit.** You cannot
paste it to the model; if you could, the skill being practised would be
pasting.

You have three messages and you do not have to use them. Submitting with a
turn in hand is a better result, and the report says which happened.

```python
def slugify(title, max_length):
    """Lowercased, hyphen-separated, at most max_length chars, never edged with hyphens.

    Write this with the model. When you are satisfied, submit - the hidden
    suite runs against whatever is in here.
    """
    raise NotImplementedError
```

## Tests

```python
def test_basic_title():
    assert slugify("Hello World", 50) == "hello-world"


def test_collapses_separator_runs():
    # One hyphen per run, not one per character: comma, space, space is a
    # single seam in the title, so it is a single hyphen in the slug.
    assert slugify("Hello,   World!", 50) == "hello-world"


def test_mixed_punctuation():
    assert slugify("Rust & Go: A Comparison", 50) == "rust-go-a-comparison"


def test_no_leading_hyphen():
    assert slugify("...Hello", 50) == "hello"


def test_no_trailing_hyphen():
    assert slugify("Hello!!!", 50) == "hello"


def test_truncates_to_max_length():
    assert slugify("one-two-three-four", 13) == "one-two-three"


def test_truncation_cannot_end_on_a_hyphen():
    # The seam between the two promises: cutting "hello-world" at 6 lands
    # exactly on the hyphen, and "never ends with a hyphen" still holds.
    assert slugify("Hello World", 6) == "hello"


def test_truncation_mid_word():
    assert slugify("Hello World", 8) == "hello-wo"


def test_already_short_enough():
    assert slugify("ok", 50) == "ok"


def test_numbers_survive():
    assert slugify("Top 10 Tips", 50) == "top-10-tips"
```

## Solution

```python
import re


def slugify(title, max_length):
    """Lowercased, hyphen-separated, at most max_length chars, never edged with hyphens."""
    # One substitution per RUN of non-alphanumerics ([^a-z0-9]+, note the +),
    # not per character - "Hello,   World" has one seam, so one hyphen.
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")

    # The clause models drop: the cut can land exactly on a hyphen, and
    # "never ends with a hyphen" applies AFTER truncation too. Slicing and
    # returning gives "hello-" for ("Hello World", 6); the second strip is
    # the whole difference.
    return slug[:max_length].rstrip("-")
```
