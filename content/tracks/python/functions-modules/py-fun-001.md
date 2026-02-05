---
slug: python-functions-modules-temperature-converter
title: Temperature Converter Module
description: Create a reusable module with functions to convert between Celsius and Fahrenheit temperatures
difficulty: beginner
hints:
  - The formula to convert Celsius to Fahrenheit is (C × 9/5) + 32
  - The formula to convert Fahrenheit to Celsius is (F - 32) × 5/9
  - Use the 'def' keyword to define a function
  - Import functions using 'from module_name import function_name'
tags:
  - functions
  - modules
  - imports
  - calculations
---

In this exercise, you'll create a temperature converter module with two functions, then import and use them in another file. This demonstrates how to organize code into reusable modules.

First, complete the `temperature.py` module with two conversion functions. Then, complete the main script that imports and uses these functions.

```python
# temperature.py - Module with temperature conversion functions

___blank_start___def___blank_end___ celsius_to_fahrenheit(celsius):
    """Convert Celsius to Fahrenheit"""
    return (celsius * 9/5) + 32

def fahrenheit_to_celsius(fahrenheit):
    """Convert Fahrenheit to Celsius"""
    ___blank_start___return (fahrenheit - 32) * 5/9___blank_end___


# main.py - Script that uses the temperature module

___blank_start___from temperature import celsius_to_fahrenheit, fahrenheit_to_celsius___blank_end___

# Test the conversions
freezing_f = celsius_to_fahrenheit(0)
boiling_f = celsius_to_fahrenheit(100)

room_temp_c = fahrenheit_to_celsius(72)

print(f"0°C = {freezing_f}°F")
print(f"100°C = {boiling_f}°F")
print(f"72°F = {___blank_start___room_temp_c___blank_end___}°C")
```

## Tests

```python


def test_temperature_conversions():
    assert celsius_to_fahrenheit(0) == 32
    assert celsius_to_fahrenheit(100) == 212
    assert round(fahrenheit_to_celsius(72), 2) == 22.22


def test_room_temp_output_variable():
    assert room_temp_c == fahrenheit_to_celsius(72)
```
