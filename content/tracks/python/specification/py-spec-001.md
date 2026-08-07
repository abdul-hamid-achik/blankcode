---
slug: py-spec-001
title: 'Pin it down: the cases that make a tag list unambiguous'
description: Six implementations of parse_tags. One is right and five are subtly wrong, and every one of them satisfies a careless reading of the request. Write the cases that tell them apart.
difficulty: intermediate
type: challenge
hints:
  - Each wrong implementation ignores exactly one sentence of the description. Read it one sentence at a time and ask what input would expose that.
  - Two of the wrong ones agree with the right one on every simple input. Deduplication is only interesting when the duplicate is not adjacent, and order is only interesting when it is not already alphabetical.
  - Your expected values have to be right too — the correct implementation has to pass every case you write.
tags:
  - specification
  - testing
  - code-review
---

"Split this on commas and clean it up" is a request that sounds complete and is
not. Whether `Python, python` is one tag or two, and whether the result comes
back in the order it was written, are decisions somebody is going to make — and
if you did not make them, you will find out which way they went a long time
later, from a bug report.

Here is the description, stated properly:

> `parse_tags(value)` turns a comma-separated string into a list of tags. Each
> tag is lowercased and has its surrounding whitespace removed. Tags that are
> empty after that are dropped. Duplicates are removed, keeping the first
> occurrence. The remaining tags stay in the order they appeared.

Below are six implementations. One satisfies that description. Five satisfy a
reading of it that skips one sentence — and all five look fine.

**Your job is not to write `parse_tags`.** It is to write the cases that accept
the correct implementation and reject each of the other five.

Two of the wrong ones are worth thinking about before you start. One deduplicates
by sorting, so it agrees with the correct implementation on every input that was
already in alphabetical order. Another never deduplicates at all, so it agrees on
every input with no repeats. Neither is exposed by an input you would type
without meaning to.

```python
# The cases that pin the description down.
#
# To pass, this list must accept the correct implementation and reject each of
# the five wrong ones. A case whose expected value is not what the description
# requires will fail against the correct implementation, so getting the values
# right is part of the exercise.
#
# Each case is a tuple: (input string, expected list of tags).
CASES = [
    # Your cases here
]
```

## Tests

```python
def correct(value):
    """Satisfies every sentence of the description."""
    seen = []
    for raw in value.split(","):
        tag = raw.strip().lower()
        if tag and tag not in seen:
            seen.append(tag)
    return seen


def keeps_case(value):
    """Skips 'each tag is lowercased'."""
    seen = []
    for raw in value.split(","):
        tag = raw.strip()
        if tag and tag not in seen:
            seen.append(tag)
    return seen


def keeps_whitespace(value):
    """Skips 'has its surrounding whitespace removed'."""
    seen = []
    for raw in value.split(","):
        tag = raw.lower()
        if tag and tag not in seen:
            seen.append(tag)
    return seen


def keeps_empty(value):
    """Skips 'tags that are empty after that are dropped'."""
    seen = []
    for raw in value.split(","):
        tag = raw.strip().lower()
        if tag not in seen:
            seen.append(tag)
    return seen


def keeps_duplicates(value):
    """Skips 'duplicates are removed'."""
    return [raw.strip().lower() for raw in value.split(",") if raw.strip()]


def sorts_instead(value):
    """Deduplicates, but throws the order away doing it."""
    return sorted({raw.strip().lower() for raw in value.split(",") if raw.strip()})


WRONG = [
    ("one that never lowercases", keeps_case),
    ("one that never strips whitespace", keeps_whitespace),
    ("one that keeps empty tags", keeps_empty),
    ("one that keeps duplicates", keeps_duplicates),
    ("one that sorts instead of preserving order", sorts_instead),
]


def survives(implementation):
    return all(implementation(text) == expected for text, expected in CASES)


def test_cases_exist():
    assert len(CASES) > 0


def test_every_expected_value_is_correct():
    # A case built around a guess would reject the right implementation, so the
    # expected values are checked before anything else is concluded from them.
    for text, expected in CASES:
        assert correct(text) == expected, f"for input {text!r}"


def test_cases_accept_the_correct_implementation():
    assert survives(correct)


def test_cases_reject_every_wrong_implementation():
    surviving = [name for name, implementation in WRONG if survives(implementation)]
    assert surviving == [], f"these wrong implementations passed: {surviving}"


def test_cases_reject_the_one_that_never_lowercases():
    assert not survives(keeps_case)


def test_cases_reject_the_one_that_never_strips():
    assert not survives(keeps_whitespace)


def test_cases_reject_the_one_that_keeps_empty_tags():
    assert not survives(keeps_empty)


def test_cases_reject_the_one_that_keeps_duplicates():
    assert not survives(keeps_duplicates)


def test_cases_reject_the_one_that_sorts():
    assert not survives(sorts_instead)


def test_cases_do_not_pass_by_sheer_volume():
    # Five wrong implementations need at most five inputs to expose. Fifty
    # near-identical cases are not a specification, and the habit is expensive.
    assert len(CASES) <= 12


def test_cases_have_no_duplicate_inputs():
    inputs = [text for text, _ in CASES]
    assert len(set(inputs)) == len(inputs)
```

## Solution

```python
# Five wrong implementations, five sentences of the description, and each case
# below is aimed at exactly one of them. That is the whole method: read the
# specification one clause at a time and ask what input would make a version
# that ignored this clause visibly disagree.
#
# Notice what is missing. There is no case like ("python,go", ["python", "go"]).
# All six implementations agree on that input, which is exactly why it feels
# safe to write and tells you nothing. Agreement on the easy input is what keeps
# the disagreement on the hard one hidden until production.
CASES = [
    # Lowercasing, isolated. Nothing else about this input is unusual, so a
    # failure here has exactly one possible cause — which is what makes a
    # failing case worth reading rather than worth debugging.
    ("Python,TypeScript", ["python", "typescript"]),

    # Whitespace around the separator. People type this constantly and rarely
    # test it, because when you write the input by hand you write it tidily.
    ("go , rust", ["go", "rust"]),

    # A trailing separator, or a doubled one, produces an empty tag. Real input
    # has this in it all the time; hand-written test input never does.
    ("go,,rust", ["go", "rust"]),

    # A repeat. Needed because the implementation that never deduplicates agrees
    # with the correct one on every input where nothing repeats — which is every
    # input you would write without specifically thinking about duplicates.
    ("go,rust,go", ["go", "rust"]),

    # Order, tested with input that is not already alphabetical. This is the
    # case people leave out: the implementation that deduplicates by sorting is
    # indistinguishable from the correct one until you hand it something out of
    # order, and "python, rust" is in order by accident.
    ("zeta,alpha", ["zeta", "alpha"]),
]
```
