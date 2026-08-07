---
slug: python-functionsmodules-012
title: Creating Decorators with Arguments
description: Learn how to create decorators that accept arguments by implementing a decorator factory pattern.
difficulty: intermediate
hints:
  - "A decorator with arguments requires an extra layer of nesting - the outermost function takes the decorator arguments."
  - "The decorator factory returns the actual decorator, which in turn returns the wrapper function."
  - "Use *args and **kwargs in the wrapper to preserve the original function signature."
  - "Remember to call the decorator factory with parentheses even when no arguments are passed."
tags:
  - decorators
  - functions
  - closures
  - arguments
---

Create a decorator called `repeat` that takes an argument specifying how many times a function should be executed. The decorator should execute the function the specified number of times and return a list of all results.

For example, `@repeat(times=3)` should execute the decorated function 3 times and collect all return values in a list.

```python
def repeat(times=1):
    """Decorator factory that creates a decorator to repeat function execution."""
    def ___blank_start___decorator___blank_end___(func):
        """The actual decorator that wraps the function."""
        def wrapper(*args, **kwargs):
            """Wrapper that executes the function multiple times."""
            results = []
            for _ in range(___blank_start___times___blank_end___):
                result = ___blank_start___func(*args, **kwargs)___blank_end___
                results.append(result)
            return results
        return ___blank_start___wrapper___blank_end___
    return decorator
```

## Tests

```python
def test_repeat_decorator_basic():
    @repeat(times=3)
    def say_hello():
        return "Hello"
    
    result = say_hello()
    assert result == ["Hello", "Hello", "Hello"]
    assert len(result) == 3


def test_repeat_decorator_with_arguments():
    @repeat(times=2)
    def greet(name):
        return f"Hello, {name}!"
    
    result = greet("Alice")
    assert result == ["Hello, Alice!", "Hello, Alice!"]


def test_repeat_decorator_default_times():
    @repeat()
    def get_value():
        return 42
    
    result = get_value()
    assert result == [42]
    assert len(result) == 1


def test_repeat_decorator_with_counter():
    counter = {"count": 0}
    
    @repeat(times=5)
    def increment():
        counter["count"] += 1
        return counter["count"]
    
    result = increment()
    assert result == [1, 2, 3, 4, 5]
    assert counter["count"] == 5


def test_repeat_decorator_with_multiple_args():
    @repeat(times=3)
    def add(a, b):
        return a + b
    
    result = add(2, 3)
    assert result == [5, 5, 5]
```