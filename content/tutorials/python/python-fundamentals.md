---
title: "Python Fundamentals"
slug: "python-fundamentals"
description: "Names, f-strings, functions with real default-argument semantics, control flow, and the exceptions you actually need."
track: "python"
order: 1
difficulty: "beginner"
tags: ["basics", "variables", "functions", "control-flow", "strings", "exceptions"]
practice:
  concept: "functions-modules"
  label: "Functions and modules"
---

Python looks like pseudocode, which makes it easy to read past the parts
that actually matter. A variable is not a box, a default argument is not
re-evaluated on every call, and `except:` with nothing after it is not "catch
the error" — it is "catch every error," including the ones you wanted to
crash. This tutorial covers the syntax fast and spends more time on the four
or five places where the reading gets ahead of the model.

## Names, Not Boxes

`x = 5` does not put `5` inside a container called `x`. It binds the name
`x` to an object that already exists — Python creates the integer, string,
or list first, and assignment just points a name at it. Two names can point
at the same object.

```python
a = [1, 2, 3]
b = a
b.append(4)
print(a)                  # [1, 2, 3, 4] — a and b are the same list
print(a is b)              # True: same object
print(a == [1, 2, 3, 4])   # True: equal value, doesn't require being the same object
```

`is` checks identity — same object in memory. `==` checks equality — same
value. Use `==` unless you specifically mean "the same object," which in
practice means comparing to `None`, `True`, or `False`. Small integers and
short strings are cached by the interpreter, so `is` can appear to work for
them and then stop working the moment the numbers get bigger. That caching
is an implementation detail, not a guarantee — code that relies on it is
already broken, it just hasn't failed yet.

```python
name, age, height, is_student, nothing = "Alice", 30, 5.7, False, None
print(type(name), type(age), type(height), type(is_student), type(nothing))
# <class 'str'> <class 'int'> <class 'float'> <class 'bool'> <class 'NoneType'>
```

`None` means "no value," not zero or empty. A function without an explicit
`return` returns `None`, which is why a forgotten `return` fails silently
instead of raising.

## Strings and F-Strings

F-strings evaluate any expression inside `{}` at the point the string is
built, including function calls and format specs.

```python
first, last = "Grace", "Hopper"
print(f"Hello, {first} {last}!")       # Hello, Grace Hopper!

price = 19.99
print(f"Total: ${price * 1.08:.2f}")   # Total: $21.59

message = "  hello world  "
print(message.strip().title())         # "Hello World"
print("hello" in message)              # True
```

A trick most people never find on their own: add `=` right after the
expression and the f-string prints both the source text and its value.

```python
count = 7
print(f"{count=}")   # count=7
```

That one line replaces `print("count:", count)` and stays correct when you
rename the variable, because the label is generated from the expression
itself rather than typed separately.

## Functions and Default Arguments

```python
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

print(greet("Ada"))                  # Hello, Ada!
print(greet("Ada", greeting="Hi"))   # Hi, Ada!

def total(*numbers):
    return sum(numbers)

def build_profile(name, **details):
    return {"name": name, **details}

print(total(1, 2, 3, 4))                       # 10
print(build_profile("Ada", role="engineer"))   # {'name': 'Ada', 'role': 'engineer'}
```

Here is the one that catches almost everyone once: a default argument value
is evaluated **once**, when the `def` statement runs — not once per call.
For an immutable default like `"Hello"` this is invisible. For a mutable
default it is a bug that survives code review, because the function looks
correct in isolation.

```python
def add_item(item, cart=[]):     # cart is built ONE TIME, at def
    cart.append(item)
    return cart

print(add_item("apple"))    # ['apple']
print(add_item("banana"))   # ['apple', 'banana'] — same list, still there
```

The fix is a `None` sentinel and a fresh object built inside the function:

```python
def add_item(item, cart=None):
    if cart is None:
        cart = []
    cart.append(item)
    return cart
```

::code-blank{lang="python" href="/tracks/python/functions-modules" label="practice functions and modules for real"}
---
code: |
  def total(*numbers):
      return ___blank_start___sum___blank_end___(numbers)

  def build_profile(name, **details):
      return {"name": name, **___blank_start___details___blank_end___}
---
::

## Control Flow

```python
score = 85
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "F"

status = "pass" if score >= 60 else "fail"   # ternary expression

for i in range(2, 10, 3):
    print(i)          # 2, 5, 8 — stop (10) is never reached

count = 0
while count < 5:
    count += 1
```

`range(2, 10, 3)` stops *before* 10, not at it — every range and every slice
in Python is half-open on the right. It is the single most common
off-by-one source in beginner code, and the rule is consistent everywhere it
applies: `stop` is a boundary you approach, not a value you get.

A `for` loop also has an `else` clause, and it is not about the loop
failing — it runs when the loop finishes *without* hitting a `break`. It
reads strangely until you think of it as "or, if nothing broke":

```python
def has_duplicate(items):
    seen = set()
    for item in items:
        if item in seen:
            break
        seen.add(item)
    else:
        return False
    return True
```

::code-blank{lang="python" href="/tracks/python/functions-modules" label="practice functions and modules for real"}
---
code: |
  score = 72
  if score >= 90:
      grade = "A"
  ___blank_start___elif___blank_end___ score >= 70:
      grade = "C"
  else:
      grade = "F"
---
::

## Exceptions

`try`/`except` handles errors without crashing the program. `else` runs only
when nothing was raised; `finally` always runs, whether or not it was.

```python
def safe_divide(a, b):
    try:
        result = a / b
    except ZeroDivisionError:
        return None
    except TypeError:
        return None
    else:
        return result
    finally:
        print("division attempted")
```

Catch the narrowest exception type that applies. A bare `except:` (or
`except Exception:` used the same way) catches everything, including
`KeyboardInterrupt`. If you must catch broadly, log what you caught and
re-raise — don't swallow it.

## Importing Modules

```python
import math
print(math.sqrt(16))   # 4.0

from datetime import datetime, timedelta
tomorrow = datetime.now() + timedelta(days=1)

import collections as col
counter = col.Counter("abracadabra")
print(counter.most_common(3))   # [('a', 5), ('b', 2), ('r', 2)]
```

A module is imported and executed exactly once per process — every later
`import` of the same module returns the cached module object instead of
re-running it. That's why the standard guard exists:

```python
if __name__ == "__main__":
    main()
```

`__name__` is `"__main__"` only when the file is run directly, so this
pattern lets a file define reusable functions *and* be run as a script,
without the reusable part firing every time something else imports it.

::code-blank{lang="python" href="/tracks/python/functions-modules" label="practice functions and modules for real"}
---
code: |
  import collections ___blank_start___as___blank_end___ col
---
::

## Where This Bites

**A mutable default argument is shared across every call that doesn't pass
one.** It is built once, at `def` time, and every subsequent call gets the
same object back. Use `None` as the sentinel and build the mutable value
inside the function body.

**A bare `except:` catches things you didn't mean to catch**, including
`KeyboardInterrupt` and `SystemExit`, which means Ctrl-C stops doing what you
expect. Name the exception types you're actually prepared to handle.

**`range` and slices never include their stop value.** `range(0, 10)` is ten
numbers, 0 through 9; `nums[2:5]` is three items, indices 2 through 4. Read
`stop` as "the first index excluded," not "the last index included."

**`is` compares identity, not value, and gives the right answer for small
cached integers and short strings by accident.** That's exactly what makes
`if x is 5:` ship — it works in testing and stops working once `x` is a
larger number. Use `==` for values; save `is` for `None`.
