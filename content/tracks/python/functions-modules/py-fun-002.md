---
slug: python-functions-modules-calculator
title: Building a Simple Calculator Module
description: Create a calculator module with functions for basic arithmetic operations and learn how to import and use them.
difficulty: beginner
hints:
  - Functions are defined using the 'def' keyword followed by the function name and parameters
  - Use 'import' to bring in functions from other modules
  - The 'from' keyword lets you import specific functions from a module
  - Function names should be descriptive of what they do
tags:
  - functions
  - modules
  - imports
  - arithmetic
---

In this exercise, you'll create a calculator module with basic arithmetic functions, then import and use those functions in a main program.

Complete the code by filling in the blanks to:
1. Define a function for multiplication
2. Import the math_operations module
3. Use the imported addition function
4. Import a specific function using the 'from' keyword

```python
# File: math_operations.py

def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def ___blank_start___multiply___blank_end___(a, b):
    return a * b

def divide(a, b):
    if b != 0:
        return a / b
    return "Cannot divide by zero"


# File: main.py

___blank_start___import math_operations___blank_end___

# Using functions from the imported module
result1 = ___blank_start___math_operations.add___blank_end___(10, 5)
print(f"10 + 5 = {result1}")

result2 = math_operations.subtract(10, 5)
print(f"10 - 5 = {result2}")

# Import specific function
___blank_start___from math_operations import divide___blank_end___

result3 = divide(10, 2)
print(f"10 / 2 = {result3}")
```

## Tests

```python


def test_math_operations():
    assert multiply(10, 5) == 50
    assert math_operations.add(10, 5) == 15
    assert math_operations.subtract(10, 5) == 5
    assert divide(10, 2) == 5
```
