---
title: "Advanced Python"
slug: "python-advanced"
description: "Explore decorators, generators, context managers, type hints, and modern Python features"
track: "python"
order: 4
difficulty: "advanced"
tags: ["decorators", "generators", "type-hints", "context-managers", "pattern-matching", "async"]
---

# Advanced Python

> **Requires Python 3.10+** — this tutorial uses structural pattern matching (`match`/`case`) and the `X | Y` union type syntax, both introduced in Python 3.10.

This tutorial covers Python features that help you write cleaner, more expressive, and more robust code. Each topic builds on your existing knowledge of functions and classes.

## Decorators

A decorator is a function that takes another function as input and returns a modified version of it. Decorators let you add behavior to functions without changing their source code.

### Function Decorators

```python
import functools
import time

def timer(func):
    """Log how long a function takes to run."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

@timer
def slow_sum(n):
    return sum(range(n))

slow_sum(1_000_000)  # slow_sum took 0.0312s
```

`@functools.wraps(func)` preserves the original function's name and docstring. Always include it when writing decorators.

### Decorators with Arguments

To create a decorator that accepts arguments, add an extra layer of nesting.

```python
import functools

def retry(max_attempts=3):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    print(f"Attempt {attempt} failed: {e}")
            raise last_error
        return wrapper
    return decorator

@retry(max_attempts=5)
def unreliable_fetch(url):
    import random
    if random.random() < 0.7:
        raise ConnectionError("Network timeout")
    return "data"
```

### Caching with `functools.lru_cache`

`functools.lru_cache` is a built-in decorator that memoizes function results. It is especially useful for recursive or expensive computations.

```python
import functools

@functools.lru_cache(maxsize=128)
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(50))  # 12586269025 (instant, without cache this would be very slow)
print(fibonacci.cache_info())
# CacheInfo(hits=48, misses=51, maxsize=128, currsize=51)
```

## Generators and `yield`

Generators produce values lazily, one at a time, instead of building an entire list in memory. They are perfect for processing large datasets or infinite sequences.

```python
def fibonacci():
    """Infinite Fibonacci sequence."""
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# take the first 10 values
fib = fibonacci()
first_ten = [next(fib) for _ in range(10)]
print(first_ten)  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

Generator expressions use parentheses instead of brackets and produce values lazily. You can also chain generators into pipelines and use `yield from` to delegate to sub-generators.

```python
def flatten(nested):
    for item in nested:
        if isinstance(item, list):
            yield from flatten(item)
        else:
            yield item

print(list(flatten([1, [2, [3, 4]], 5])))  # [1, 2, 3, 4, 5]
```

## Context Managers

Context managers handle setup and cleanup through the `with` statement. The most common example is file handling, but you can create custom context managers for any resource.

### Using `contextlib`

```python
from contextlib import contextmanager
import time

@contextmanager
def time_block(label):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        print(f"{label}: {elapsed:.4f}s")

with time_block("processing"):
    total = sum(range(1_000_000))
# processing: 0.0298s
```

For full control, you can also write class-based context managers by implementing `__enter__` (setup, returns the resource) and `__exit__` (cleanup, receives exception info). Return `False` from `__exit__` to let exceptions propagate, or `True` to suppress them.

## Type Hints and the `typing` Module

Type hints make your code self-documenting and enable static analysis with tools like `mypy`. They have no runtime effect by default.

```python
def find_user(user_id: int, active_only: bool = True) -> dict | None:
    """Look up a user by ID. Returns None if not found."""
    users = {1: {"name": "Alice", "active": True}}
    user = users.get(user_id)
    if user and (not active_only or user["active"]):
        return user
    return None
```

### Common Type Patterns

```python
from typing import TypeAlias

# type aliases for readability
JsonValue: TypeAlias = str | int | float | bool | None | list | dict
Headers: TypeAlias = dict[str, str]

def fetch(url: str, headers: Headers | None = None) -> bytes:
    ...

# callable types
from collections.abc import Callable

def apply_twice(func: Callable[[int], int], value: int) -> int:
    return func(func(value))

result = apply_twice(lambda x: x * 2, 3)  # 12

# generics (Python 3.12+ PEP 695 syntax)
def first[T](items: list[T]) -> T | None:
    return items[0] if items else None
```

Note: the `def first[T]` syntax requires Python 3.12+. For Python 3.10-3.11, use `TypeVar` instead:

```python
from typing import TypeVar

T = TypeVar("T")

def first(items: list[T]) -> T | None:
    return items[0] if items else None
```

## The Walrus Operator

The walrus operator `:=` (introduced in Python 3.8) assigns a value to a variable as part of an expression. It reduces duplication in common patterns.

```python
# assign inside an expression to avoid repeating yourself
while (line := input("Enter command: ")) != "quit":
    print(f"Processing: {line}")

# useful in comprehensions with expensive computations
import math
values = [7, 15, 23, 42, 100]
results = [
    (v, root)
    for v in values
    if (root := math.sqrt(v)) > 4
]
print(results)  # [(23, 4.795...), (42, 6.480...), (100, 10.0)]
```

## Structural Pattern Matching

Pattern matching (introduced in Python 3.10) provides a powerful way to destructure and match data. It goes beyond simple value comparison to handle sequences, mappings, and objects.

```python
def handle_command(command):
    match command.split():
        case ["quit"]:
            return "Exiting..."
        case ["greet", name]:
            return f"Hello, {name}!"
        case ["move", direction, distance]:
            return f"Moving {direction} by {distance}"
        case ["add", *items]:
            return f"Adding items: {', '.join(items)}"
        case _:
            return f"Unknown command: {command}"

print(handle_command("greet Alice"))      # Hello, Alice!
print(handle_command("move north 10"))    # Moving north by 10
print(handle_command("add a b c"))        # Adding items: a, b, c
```

Pattern matching also works with dictionaries and guard clauses (`if` conditions after the pattern), making it a versatile tool for dispatching on structured data.

## Async / Await Basics

Python's `asyncio` module lets you write concurrent code using `async`/`await`. This is especially useful for I/O-bound tasks like network requests, file operations, or database queries.

```python
import asyncio

async def fetch_data(url, delay):
    """Simulate a network request with a delay."""
    print(f"Fetching {url}...")
    await asyncio.sleep(delay)
    return f"Data from {url}"

async def main():
    # run tasks concurrently with gather
    results = await asyncio.gather(
        fetch_data("/api/users", 2),
        fetch_data("/api/posts", 1),
        fetch_data("/api/comments", 1.5),
    )
    for result in results:
        print(result)

asyncio.run(main())
# Fetching /api/users...
# Fetching /api/posts...
# Fetching /api/comments...
# Data from /api/users
# Data from /api/posts
# Data from /api/comments
```

Key points:
- `async def` defines a coroutine function
- `await` pauses the coroutine until the awaited task completes, allowing other tasks to run
- `asyncio.gather()` runs multiple coroutines concurrently
- `asyncio.run()` is the entry point that starts the event loop

## Practice

Try building a small pipeline using generators and decorators. For example, use `@functools.lru_cache` to memoize an expensive computation, create a generator that reads and filters log lines, and type-annotate the entire pipeline. These patterns come up constantly in real Python projects.

Explore more advanced exercises on [the Python track](/tracks/python).
