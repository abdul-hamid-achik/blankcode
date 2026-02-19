---
title: "Python Fundamentals"
slug: "python-fundamentals"
description: "Learn the core building blocks of Python: variables, functions, control flow, and more."
track: "python"
order: 1
difficulty: "beginner"
tags: ["basics", "variables", "functions", "control-flow", "strings", "exceptions"]
---

# Python Fundamentals

Python is one of the most readable and versatile programming languages. This tutorial covers the essential building blocks you need to start writing Python code confidently.

## Variables and Types

Python is dynamically typed, meaning you don't need to declare variable types explicitly. The interpreter figures it out from the value you assign.

```python
name = "Alice"
age = 30
height = 5.7
is_student = False
nothing = None

print(type(name))       # <class 'str'>
print(type(age))        # <class 'int'>
print(type(height))     # <class 'float'>
print(type(is_student)) # <class 'bool'>
print(type(nothing))    # <class 'NoneType'>
```

`None` is Python's null value. It represents the absence of a value and is commonly used as a default return, a placeholder, or to check whether a variable has been set.

You can reassign variables to values of different types at any time. Python also supports multiple assignment in a single line.

```python
x, y, z = 1, 2.5, "hello"
a = b = c = 0
```

## Strings and F-Strings

Strings in Python can be enclosed in single or double quotes. For multi-line strings, use triple quotes. F-strings (formatted string literals), introduced in Python 3.6, are the most readable way to embed expressions inside strings.

```python
first = "Grace"
last = "Hopper"

# f-string with expressions
greeting = f"Hello, {first} {last}!"
print(greeting)  # Hello, Grace Hopper!

# expressions inside f-strings
price = 19.99
print(f"Total: ${price * 1.08:.2f}")  # Total: $21.59

# multi-line strings
bio = """Name: Grace Hopper
Role: Computer Scientist
Legacy: COBOL pioneer"""

# common string methods
message = "  hello world  "
print(message.strip())        # "hello world"
print(message.strip().title()) # "Hello World"
print("hello" in message)      # True
```

## Functions and Default Arguments

Functions are defined with the `def` keyword. Python supports default argument values, keyword arguments, and variable-length argument lists.

```python
def greet(name, greeting="Hello"):
    """Return a greeting string."""
    return f"{greeting}, {name}!"

print(greet("Alice"))              # Hello, Alice!
print(greet("Bob", greeting="Hi")) # Hi, Bob!

# *args collects extra positional arguments as a tuple
def total(*numbers):
    return sum(numbers)

print(total(1, 2, 3, 4))  # 10

# **kwargs collects extra keyword arguments as a dict
def build_profile(name, **details):
    return {"name": name, **details}

profile = build_profile("Alice", age=30, role="engineer")
print(profile)  # {'name': 'Alice', 'age': 30, 'role': 'engineer'}
```

Functions are first-class objects in Python. You can assign them to variables, pass them as arguments, and return them from other functions.

```python
def apply(func, value):
    """Call func with value and return the result."""
    return func(value)

print(apply(str.upper, "hello"))  # HELLO
print(apply(len, [1, 2, 3]))     # 3
```

## Control Flow

Python uses indentation to define code blocks rather than braces or keywords.

### if / elif / else

```python
score = 85

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "F"

print(f"Score {score} => Grade {grade}")  # Score 85 => Grade B

# ternary expression
status = "pass" if score >= 60 else "fail"
```

### for loops

The `for` loop iterates over any iterable: lists, strings, ranges, and more.

```python
fruits = ["apple", "banana", "cherry"]

for fruit in fruits:
    print(fruit)

# range generates a sequence of numbers
for i in range(5):
    print(i)  # 0, 1, 2, 3, 4

# range with start, stop, step
for i in range(2, 10, 3):
    print(i)  # 2, 5, 8
```

### while loops

```python
count = 0
while count < 5:
    print(count)
    count += 1

# break and continue work in both for and while loops
for n in range(10):
    if n == 3:
        continue  # skip 3
    if n == 7:
        break     # stop at 7
    print(n)      # 0, 1, 2, 4, 5, 6
```

## Lists and Dictionaries (Preview)

Lists are ordered, mutable sequences. Dictionaries are key-value mappings. Here is a quick taste:

```python
colors = ["red", "green", "blue"]
colors.append("yellow")
print(colors)  # ['red', 'green', 'blue', 'yellow']

user = {"name": "Alice", "age": 30}
print(user["name"])             # Alice
print(user.get("email", "N/A")) # N/A (default if key missing)
```

For slicing, comprehensions, sets, tuples, and much more, see the [Data Structures Guide](/tutorials/python-data-structures-guide).

## Basic Exception Handling

Errors happen. Python uses `try`/`except`/`finally` to handle them gracefully instead of crashing your program.

```python
def safe_divide(a, b):
    try:
        result = a / b
    except ZeroDivisionError:
        print("Cannot divide by zero!")
        return None
    except TypeError:
        print("Both arguments must be numbers!")
        return None
    else:
        # runs only if no exception was raised
        print(f"{a} / {b} = {result}")
        return result
    finally:
        # always runs, whether or not an exception occurred
        print("Division attempted.")

safe_divide(10, 3)   # 10 / 3 = 3.333... → Division attempted.
safe_divide(10, 0)   # Cannot divide by zero! → Division attempted.
```

Key points:
- `try` wraps the code that might fail
- `except` catches specific exception types (catch narrow exceptions, not bare `except:`)
- `else` runs only when no exception was raised
- `finally` always runs, useful for cleanup (closing files, releasing resources)

## Importing Modules

Python has a rich standard library. Use `import` to bring modules into your code.

```python
import math
print(math.sqrt(16))  # 4.0
print(math.pi)        # 3.141592653589793

# import specific items
from datetime import datetime, timedelta

now = datetime.now()
tomorrow = now + timedelta(days=1)
print(f"Tomorrow: {tomorrow.strftime('%Y-%m-%d')}")

# alias long module names
import collections as col

counter = col.Counter("abracadabra")
print(counter.most_common(3))  # [('a', 5), ('b', 2), ('r', 2)]
```

You can also install third-party packages with `pip` and import them the same way.

## Practice

Try combining what you learned: write a function that takes a list of numbers, filters out negatives, and returns a dictionary with keys `"count"`, `"sum"`, and `"average"` for the remaining values. Wrap the division in a `try`/`except` to handle the case where all numbers are negative (empty list, division by zero).

Next up: [Data Structures Guide](/tutorials/python-data-structures-guide)
