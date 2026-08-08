---
slug: py-review-002
title: 'Review: a default argument with a memory'
description: The tagging helper below passes its tests. Call it twice and the second caller receives the first caller's data. The bug is in the signature.
difficulty: beginner
type: review
hints:
  - The shipped suite calls the function exactly once per test — and one of Python's most famous bugs needs two calls to show itself.
  - When is a default argument value created? Once per call, or once per program?
  - The idiomatic fix involves None and two lines. Resist the urge to copy the input instead.
tags:
  - code-review
  - defaults
  - mutability
---

You asked a model for a small helper: add a tag to a list of tags, returning
the list; when no list is given, start a fresh one. It produced this, with
tests. The tests pass.

Call it twice without a list and the second call returns *both* tags. Default
argument values in Python are evaluated once, at `def` time — that `[]` is a
single list object created when the module loads, shared by every call that
omits the argument, accumulating forever. Each test here calls the function
once and asserts on that one result, so the suite cannot meet the bug: it
lives *between* calls.

This is the oldest trick in the Python interview book precisely because
generated code and hurried code both keep producing it.

Find the defect and fix it. You are graded on tests you cannot see.

```python
def add_tag(tag, tags=[]):
    """Adds tag to tags and returns the list. Starts a new list when tags is omitted."""
    tags.append(tag)
    return tags
```

## The tests it came with

These all pass. Each one calls the function a single time — and this bug
needs two.

```python
def test_adds_to_a_new_list():
    assert add_tag("urgent") == ["urgent"]


def test_adds_to_an_existing_list():
    assert add_tag("later", ["urgent"]) == ["urgent", "later"]


def test_returns_the_list():
    result = add_tag("solo")
    assert isinstance(result, list)
```

## Tests

```python
def test_adds_to_a_new_list():
    assert add_tag("urgent") == ["urgent"]


def test_adds_to_an_existing_list():
    assert add_tag("later", ["urgent"]) == ["urgent", "later"]


def test_returns_the_list():
    result = add_tag("solo")
    assert isinstance(result, list)


def test_omitted_lists_are_independent():
    # The bug lives between calls: a shared default accumulates, so the
    # second "fresh" list arrives pre-populated with the first call's tag.
    first = add_tag("one")
    second = add_tag("two")
    assert second == ["two"]


def test_three_calls_stay_independent():
    add_tag("a")
    add_tag("b")
    assert add_tag("c") == ["c"]


def test_explicit_list_still_appended_in_place():
    tags = ["existing"]
    result = add_tag("new", tags)
    assert result is tags
    assert tags == ["existing", "new"]
```

## Solution

```python
def add_tag(tag, tags=None):
    """Adds tag to tags and returns the list. Starts a new list when tags is omitted."""
    # The original signature said tags=[]. Default values are evaluated once,
    # at def time — that [] was ONE list object shared by every call that
    # omitted the argument, accumulating tags across callers forever. The
    # None sentinel moves list creation inside the call, where "a fresh list
    # per call" actually lives. Copying the input instead would fix this test
    # and break the documented in-place behaviour for explicit lists.
    if tags is None:
        tags = []
    tags.append(tag)
    return tags
```
