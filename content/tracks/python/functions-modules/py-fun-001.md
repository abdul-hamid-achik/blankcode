---
slug: python-functions-modules-temperature-converter
title: Temperature Converter Module
description: Build a temperature conversion module with two functions of your own, plus a helper imported from Python's standard library.
difficulty: beginner
hints:
  - The formula to convert Celsius to Fahrenheit is (C × 9/5) + 32
  - The formula to convert Fahrenheit to Celsius is (F - 32) × 5/9
  - Use the 'def' keyword to define a function
  - 'Import specific names from a module with: from module_name import name'
tags:
  - functions
  - modules
  - imports
  - calculations
---

In this exercise, you'll build a small temperature conversion module: two functions you write yourself, plus a third that leans on Python's standard library. This shows how a module mixes your own functions with imported ones.

Complete the module by:
1. Defining `celsius_to_fahrenheit`
2. Completing `fahrenheit_to_celsius`
3. Importing `trunc` from the standard library `math` module
4. Using `trunc` to round a reading down to a whole degree

```python
___blank_start___from math import trunc___blank_end___


def celsius_to_fahrenheit(celsius):
    """Convert Celsius to Fahrenheit"""
    return (celsius * 9/5) + 32


def fahrenheit_to_celsius(fahrenheit):
    """Convert Fahrenheit to Celsius"""
    ___blank_start___return (fahrenheit - 32) * 5/9___blank_end___


def whole_degrees(temperature):
    """Truncate a temperature reading down to a whole number of degrees"""
    return ___blank_start___trunc(temperature)___blank_end___


freezing_f = celsius_to_fahrenheit(0)
boiling_f = celsius_to_fahrenheit(100)

room_temp_c = fahrenheit_to_celsius(72)
room_temp_whole = whole_degrees(room_temp_c)

print(f"0°C = {freezing_f}°F")
print(f"100°C = {boiling_f}°F")
print(f"72°F = {___blank_start___room_temp_c___blank_end___}°C ({room_temp_whole}° whole)")
```

## Tests

```python


def test_temperature_conversions():
    assert celsius_to_fahrenheit(0) == 32
    assert celsius_to_fahrenheit(100) == 212
    assert round(fahrenheit_to_celsius(72), 2) == 22.22


def test_whole_degrees():
    assert whole_degrees(22.78) == 22
    assert whole_degrees(-3.5) == -3


def test_room_temp_output_variable():
    assert room_temp_c == fahrenheit_to_celsius(72)
    assert room_temp_whole == whole_degrees(room_temp_c)
```
