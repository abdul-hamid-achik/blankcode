---
slug: py-challenge-001
title: 'Challenge: Build a Temperature Converter'
description: Implement a temperature conversion utility with proper error handling.
difficulty: beginner
type: challenge
tags:
  - functions
  - error-handling
  - basics
---

# Challenge: Temperature Converter

## Requirements

Create a temperature conversion module with the following functions:

1. **celsius_to_fahrenheit(celsius: float) -> float** - Convert Celsius to Fahrenheit
2. **fahrenheit_to_celsius(fahrenheit: float) -> float** - Convert Fahrenheit to Celsius
3. **celsius_to_kelvin(celsius: float) -> float** - Convert Celsius to Kelvin
4. **kelvin_to_celsius(kelvin: float) -> float** - Convert Kelvin to Celsius
5. **convert_temperature(value: float, from_unit: str, to_unit: str) -> float** - Universal converter

## Constraints

- Validate that temperatures don't go below absolute zero
- Raise `ValueError` for invalid temperatures
- Support unit strings: 'C', 'F', 'K' (case-insensitive)
- Round results to 2 decimal places

## Example Usage

```python
celsius_to_fahrenheit(0)    # Returns 32.0
fahrenheit_to_celsius(32)   # Returns 0.0
celsius_to_kelvin(0)        # Returns 273.15
convert_temperature(100, 'C', 'F')  # Returns 212.0
```

Write your complete implementation below:

```python
# Your implementation here
```

## Tests

```python
import pytest

def test_celsius_to_fahrenheit():
    assert celsius_to_fahrenheit(0) == 32.0
    assert celsius_to_fahrenheit(100) == 212.0
    assert celsius_to_fahrenheit(-40) == -40.0

def test_fahrenheit_to_celsius():
    assert fahrenheit_to_celsius(32) == 0.0
    assert fahrenheit_to_celsius(212) == 100.0
    assert fahrenheit_to_celsius(-40) == -40.0

def test_celsius_to_kelvin():
    assert celsius_to_kelvin(0) == 273.15
    assert celsius_to_kelvin(100) == 373.15
    assert celsius_to_kelvin(-273.15) == 0.0

def test_kelvin_to_celsius():
    assert kelvin_to_celsius(273.15) == 0.0
    assert kelvin_to_celsius(373.15) == 100.0
    assert kelvin_to_celsius(0) == -273.15

def test_convert_temperature():
    assert convert_temperature(100, 'C', 'F') == 212.0
    assert convert_temperature(32, 'F', 'C') == 0.0
    assert convert_temperature(0, 'C', 'K') == 273.15
    assert convert_temperature(273.15, 'K', 'C') == 0.0
    assert convert_temperature(100, 'c', 'f') == 212.0  # Case insensitive

def test_absolute_zero_validation():
    with pytest.raises(ValueError):
        celsius_to_fahrenheit(-300)
    with pytest.raises(ValueError):
        kelvin_to_celsius(-1)
    with pytest.raises(ValueError):
        fahrenheit_to_celsius(-500)

def test_invalid_units():
    with pytest.raises(ValueError):
        convert_temperature(100, 'X', 'C')
    with pytest.raises(ValueError):
        convert_temperature(100, 'C', 'X')
```
