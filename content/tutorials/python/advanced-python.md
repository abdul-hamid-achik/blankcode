---
title: "Advanced Python"
slug: "python-advanced"
description: "Decorators, generators, context managers, and pattern matching, plus the two features that quietly leak memory and hide bugs until you least expect it."
track: "python"
order: 4
difficulty: "advanced"
tags: ["decorators", "generators", "type-hints", "context-managers", "pattern-matching", "async"]
practice:
  concept: "advanced-python-patterns"
  label: "Advanced patterns"
---

> Requires Python 3.10+ for `match`/`case` and the `X | Y` union syntax used
> below.

These are the features that separate code that works from code that reads
as deliberate: decorators that add behavior without touching a function's
body, generators that never build the thing they're describing, and an
async model that makes I/O-bound code fast without threads. Each one also
has a specific, well-known way to misuse it — this tutorial covers both
halves.

## Decorators

A decorator takes a function and returns a replacement for it — usually a
wrapper that does something extra and then calls the original.

```python
import functools, time

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.perf_counter() - start:.4f}s")
        return result
    return wrapper

@timer
def slow_sum(n):
    return sum(range(n))

slow_sum(1_000_000)   # slow_sum took 0.0312s
```

`@functools.wraps(func)` copies the original function's `__name__` and
`__doc__` onto the wrapper. Skip it and every decorated function's identity
becomes `wrapper` — which breaks introspection, confuses debuggers, and
silently corrupts any other decorator stacked on top that reads `__name__`.

To accept arguments, add a layer of nesting — a function that returns the
actual decorator:

```python
def retry(max_attempts=3):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
            raise last_error
        return wrapper
    return decorator

@retry(max_attempts=5)
def unreliable_fetch(url): ...
```

`functools.lru_cache` is a decorator that memoizes results, which makes it
tempting to slap on any slow method. On a **bound method** it is a real
memory leak: the cache stores `self` as part of the key, so every instance
that ever called the cached method stays alive for as long as the cache
does, even after nothing else references it.

```python
class Model:
    @functools.lru_cache(maxsize=None)
    def predict(self, x):   # self is part of the cache key — instances never get collected
        ...
```

Cache a free function instead, or store the cache on the instance so it
dies with it.

::code-blank{lang="python" href="/tracks/python/advanced-python-patterns" label="practice advanced patterns for real"}
---
code: |
  def timer(func):
      @functools.___blank_start___wraps___blank_end___(func)
      def wrapper(*args, **kwargs):
          return func(*args, **kwargs)
      return wrapper
---
::

## Generators and `yield`

A generator function's body doesn't run when you call it — calling it
builds a generator object and executes nothing. The first line only runs on
the first `next()`.

```python
def fibonacci():
    print("starting")
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

fib = fibonacci()   # nothing printed yet
first = next(fib)   # NOW "starting" prints, then 0 is yielded
```

This is why a bug inside a generator function can survive code review and a
test that only calls the function without iterating it — "it didn't crash"
tells you nothing until you consume it. `yield from` delegates to a
sub-generator, which is how you flatten recursive structures without
manually re-yielding each value:

```python
def flatten(nested):
    for item in nested:
        if isinstance(item, list):
            yield from flatten(item)
        else:
            yield item

print(list(flatten([1, [2, [3, 4]], 5])))   # [1, 2, 3, 4, 5]
```

::code-blank{lang="python" href="/tracks/python/advanced-python-patterns" label="practice advanced patterns for real"}
---
code: |
  def flatten(nested):
      for item in nested:
          if isinstance(item, list):
              ___blank_start___yield___blank_end___ from flatten(item)
          else:
              yield item
---
::

## Context Managers

The `with` statement guarantees cleanup runs, even when the block raises.
`contextlib.contextmanager` turns a generator into one with a single
decorator:

```python
from contextlib import contextmanager
import time

@contextmanager
def time_block(label):
    start = time.perf_counter()
    try:
        yield
    finally:
        print(f"{label}: {time.perf_counter() - start:.4f}s")

with time_block("processing"):
    total = sum(range(1_000_000))
```

Everything before `yield` is setup, everything after (in the `finally`) is
teardown, and the `try`/`finally` is what makes teardown run on an
exception too. For full control — separate setup and teardown, state that
outlives one `with` block — write a class implementing `__enter__` and
`__exit__` instead; return `True` from `__exit__` to suppress the exception
that triggered it, `False` (or nothing) to let it propagate.

## Type Hints

Type hints are checked by tools like `mypy`, not by the interpreter — they
have zero runtime effect by default.

```python
def find_user(user_id: int, active_only: bool = True) -> dict | None:
    ...

from collections.abc import Callable
def apply_twice(func: Callable[[int], int], value: int) -> int:
    return func(func(value))

def first[T](items: list[T]) -> T | None:   # PEP 695 generic syntax, 3.12+
    return items[0] if items else None
```

For 3.10 and 3.11, write generics with `TypeVar` instead of the `[T]`
syntax: `T = TypeVar("T")`, then `def first(items: list[T]) -> T | None:`.
Annotations having no runtime effect is also why they can reference a class
that doesn't exist yet — `from __future__ import annotations` (or just
writing the type as a plain string) defers evaluation so a forward
reference doesn't need to resolve at definition time.

## Structural Pattern Matching

`match`/`case` destructures data instead of just comparing values against
it — it matches shape, not equality.

```python
def handle_command(command):
    match command.split():
        case ["quit"]:
            return "Exiting..."
        case ["greet", name]:
            return f"Hello, {name}!"
        case ["move", direction, distance]:
            return f"Moving {direction} by {distance}"
        case _:
            return f"Unknown command: {command}"

print(handle_command("greet Alice"))   # Hello, Alice!
```

Patterns can include guard clauses (`case [x, y] if x > y:`) and dictionary
shapes, which makes `match` a real alternative to a chain of `isinstance`
checks when you're dispatching on structured data rather than just a type.

::code-blank{lang="python" href="/tracks/python/advanced-python-patterns" label="practice advanced patterns for real"}
---
code: |
  match command.split():
      case ["quit"]:
          return "Exiting..."
      ___blank_start___case___blank_end___ ["greet", name]:
          return f"Hello, {name}!"
      case _:
          return f"Unknown command: {command}"
---
::

## Async / Await

`asyncio` gives you concurrency for I/O-bound work — network calls,
database queries — without threads. `await` pauses the current coroutine
and lets other coroutines run while it waits.

```python
import asyncio

async def fetch(url, delay):
    await asyncio.sleep(delay)
    return f"data from {url}"

async def main():
    results = await asyncio.gather(
        fetch("/users", 2),
        fetch("/posts", 1),
    )
    print(results)

asyncio.run(main())
```

`asyncio.gather()` fails fast by default: the first exception raised by any
coroutine propagates immediately and cancels the rest, so you lose whatever
the other coroutines would have returned. Pass `return_exceptions=True`
when partial results are useful — exceptions come back in the results list
instead of being raised, and you check for them yourself.

## Where This Bites

**`@functools.lru_cache` on a bound method keeps every instance that ever
called it alive**, because the cache holds `self` as part of its key.
Decorate a free function instead, or cache on the instance so the cache
dies with it.

**A missing `@functools.wraps` breaks anything that reads the wrapped
function's identity** — debuggers, doc generators, and other decorators
that inspect `__name__`. Always wrap, even in a five-line decorator you're
sure you'll never stack.

**A generator function runs none of its body until the first `next()`.**
Calling it just builds the generator object, so "the call didn't raise"
proves nothing about whether the code inside is correct — iterate it, in
tests and in review, before trusting it.

**`asyncio.gather()` cancels the group on the first exception by default.**
If you want the other coroutines' results even when one fails, pass
`return_exceptions=True` and check each result for an exception yourself.
