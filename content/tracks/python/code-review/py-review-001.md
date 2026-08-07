---
slug: py-review-001
title: 'Review: a retry that gives up too early'
description: A retry helper that reads perfectly and retries one time fewer than you asked for. The tests it came with never noticed.
difficulty: intermediate
type: review
hints:
  - Count the calls by hand for max_retries=3, assuming every attempt fails.
  - "`max_retries` counts retries. The first call is not one of them."
  - The tests it came with only ever assert that it eventually succeeded, never how many times it tried.
tags:
  - code-review
  - retries
  - off-by-one
---

You asked a model for a retry helper with backoff. It produced this, with tests.
The tests pass.

It retries one time fewer than the caller asked for. On a flaky service that is
the difference between a request that recovers and one that surfaces as an error
to a user — and nothing about the code looks wrong.

Find the defect and fix it. You are graded on tests you cannot see.

```python
import time


def retry(fn, max_retries=3, delay=0.01, backoff=2.0, should_retry=None):
    """Calls fn(), retrying on failure with exponential backoff.

    max_retries is the number of retries after the initial attempt.
    """
    last_error = None

    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as error:
            last_error = error

            if should_retry is not None and not should_retry(error, attempt + 1):
                break

            if attempt < max_retries - 1:
                time.sleep(delay * (backoff**attempt))

    raise last_error
```

## The tests it came with

These all pass. They are here so you can see what a passing suite proves, and
what it does not.

```python
def test_returns_on_first_success():
    assert retry(lambda: 42) == 42


def test_recovers_after_one_failure():
    calls = []

    def flaky():
        calls.append(1)
        if len(calls) < 2:
            raise ValueError("not yet")
        return "ok"

    assert retry(flaky) == "ok"


def test_raises_when_it_never_succeeds():
    def always():
        raise ValueError("nope")

    try:
        retry(always, max_retries=2)
        assert False, "should have raised"
    except ValueError:
        pass
```

## Tests

```python
import pytest


def test_returns_on_first_success():
    assert retry(lambda: 42) == 42


def test_recovers_after_one_failure():
    calls = []

    def flaky():
        calls.append(1)
        if len(calls) < 2:
            raise ValueError("not yet")
        return "ok"

    assert retry(flaky) == "ok"


def test_raises_when_it_never_succeeds():
    def always():
        raise ValueError("nope")

    with pytest.raises(ValueError):
        retry(always, max_retries=2)


def test_makes_initial_attempt_plus_max_retries():
    # max_retries=3 means one call and then three more.
    calls = []

    def always():
        calls.append(1)
        raise ValueError("nope")

    with pytest.raises(ValueError):
        retry(always, max_retries=3)

    assert len(calls) == 4


def test_succeeds_on_the_final_retry():
    calls = []

    def flaky():
        calls.append(1)
        if len(calls) < 4:
            raise ValueError("not yet")
        return "ok"

    assert retry(flaky, max_retries=3) == "ok"
    assert len(calls) == 4


def test_zero_retries_calls_once():
    calls = []

    def always():
        calls.append(1)
        raise ValueError("nope")

    with pytest.raises(ValueError):
        retry(always, max_retries=0)

    assert len(calls) == 1


def test_stops_when_should_retry_says_no():
    calls = []

    def always():
        calls.append(1)
        raise ValueError("nope")

    with pytest.raises(ValueError):
        retry(always, max_retries=5, should_retry=lambda error, attempt: attempt < 2)

    assert len(calls) == 2
```

## Solution

```python
import time


def retry(fn, max_retries=3, delay=0.01, backoff=2.0, should_retry=None):
    """Calls fn(), retrying on failure with exponential backoff.

    max_retries is the number of retries after the initial attempt.
    """
    last_error = None

    # `range(max_retries)` counted the *total* attempts, so max_retries=3 gave
    # three calls: the first one and two retries. The docstring said the first
    # call is not a retry, and the loop disagreed with it.
    #
    # Every test it came with either succeeded within two attempts or only
    # checked that it eventually raised, so none of them could see the
    # difference.
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as error:
            last_error = error

            if should_retry is not None and not should_retry(error, attempt + 1):
                break

            if attempt < max_retries:
                time.sleep(delay * (backoff**attempt))

    raise last_error
```
