---
slug: python-functions-modules-calculator
title: Building a Simple Calculator Module
description: Write your own arithmetic functions, then bring in real Python standard library functions alongside them with import and from...import.
difficulty: beginner
hints:
  - Functions are defined using the 'def' keyword followed by the function name and parameters
  - Use 'import module_name' to bring in a whole module, then call its functions as 'module_name.function_name(...)'
  - The 'from' keyword lets you import a specific name straight into your file, e.g. 'from math import factorial'
  - Function names should be descriptive of what they do
tags:
  - functions
  - modules
  - imports
  - arithmetic
---

In this exercise, you'll build a calculator that mixes functions you write yourself with functions imported from Python's standard library. Real modules work exactly this way — you rarely write everything from scratch.

Complete the code by filling in the blanks to:
1. Define a function for multiplication
2. Import the standard library `operator` module
3. Use the imported module's addition function
4. Import a specific function using the `from` keyword

```python
___blank_start___import operator___blank_end___


def ___blank_start___multiply___blank_end___(a, b):
    return a * b


def divide(a, b):
    if b != 0:
        return a / b
    return "Cannot divide by zero"


# Using functions from the imported operator module
result1 = ___blank_start___operator.add___blank_end___(10, 5)
print(f"10 + 5 = {result1}")

result2 = operator.sub(10, 5)
print(f"10 - 5 = {result2}")

# Import a specific function using 'from'
___blank_start___from math import factorial___blank_end___

result3 = divide(10, 2)
print(f"10 / 2 = {result3}")

result4 = factorial(5)
print(f"5! = {result4}")
```

## Tests

```python


def test_math_operations():
    assert multiply(10, 5) == 50
    assert operator.add(10, 5) == 15
    assert operator.sub(10, 5) == 5
    assert divide(10, 2) == 5
    assert factorial(5) == 120
```
