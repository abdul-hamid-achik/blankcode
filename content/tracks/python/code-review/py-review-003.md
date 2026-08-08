---
slug: py-review-003
title: 'Review: three buttons that all do the same thing'
description: The handler factory below passes its test. Build three handlers and every one of them behaves like the last. The oldest closure bug in Python — find the late binding.
difficulty: advanced
type: review
hints:
  - The shipped test builds handlers for one discount only. The bug needs at least two to show itself.
  - When does the lambda look up `rate` — when the lambda is created, or when it is called? By then, what is `rate`?
  - Default arguments are evaluated at definition time. For once, that behaviour is the cure instead of the disease.
tags:
  - code-review
  - closures
  - late-binding
---

You asked a model for a small factory: given a list of discount rates, build
one pricing function per rate. It produced this, with a test. The test
passes.

Build handlers for `[0.1, 0.2, 0.3]` and all three apply thirty percent.
A Python closure captures the *variable*, not the value it held: every
lambda shares the single loop variable `rate`, reads it at call time, and by
call time the loop is long finished — `rate` holds its final value for
everyone. The shipped test uses a one-element list, the only length at
which "each lambda gets its own rate" and "every lambda gets the last rate"
are the same claim.

This bug has a decades-old idiom for a fix, and models reproduce the bug
more often than the idiom.

Find the defect and fix it. You are graded on tests you cannot see.

```python
def build_pricers(rates):
    """Returns one pricing function per rate, in order.

    Each function takes a price and returns it with that rate discounted:
    build_pricers([0.1])[0](100) == 90.0
    """
    pricers = []
    for rate in rates:
        pricers.append(lambda price: price * (1 - rate))
    return pricers
```

## The tests it came with

This passes. With one rate in the list, the last rate and every rate are
the same rate.

```python
def test_single_rate():
    pricers = build_pricers([0.1])
    assert pricers[0](100) == 90.0
```

## Tests

```python
def test_single_rate():
    pricers = build_pricers([0.1])
    assert pricers[0](100) == 90.0


def test_each_pricer_keeps_its_own_rate():
    # The bug needs two rates to exist at all: shared late binding hands
    # every lambda the loop's final value.
    pricers = build_pricers([0.1, 0.2])
    assert pricers[0](100) == 90.0
    assert pricers[1](100) == 80.0


def test_three_rates_stay_distinct():
    pricers = build_pricers([0.1, 0.2, 0.5])
    results = [pricer(100) for pricer in pricers]
    assert results == [90.0, 80.0, 50.0]


def test_order_matches_input():
    pricers = build_pricers([0.5, 0.1])
    assert pricers[0](200) == 100.0
    assert pricers[1](200) == 180.0


def test_empty_rates():
    assert build_pricers([]) == []


def test_zero_rate_charges_full_price():
    pricers = build_pricers([0.0, 0.3])
    assert pricers[0](80) == 80.0
```

## Solution

```python
def build_pricers(rates):
    """Returns one pricing function per rate, in order.

    Each function takes a price and returns it with that rate discounted:
    build_pricers([0.1])[0](100) == 90.0
    """
    pricers = []
    for rate in rates:
        # The original closed over `rate` itself - the VARIABLE, one per
        # loop, not per iteration. Every lambda read it at call time, after
        # the loop had left it at the final rate. A default argument is
        # evaluated at definition time, per lambda, which freezes each
        # iteration's value exactly where it was needed. (The same
        # definition-time rule that makes mutable defaults a bug makes this
        # idiom work.)
        pricers.append(lambda price, rate=rate: price * (1 - rate))
    return pricers
```
