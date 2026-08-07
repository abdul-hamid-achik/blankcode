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

Write your complete implementation below:

```python
# Your implementation here
```

## Example Usage

```python
celsius_to_fahrenheit(0)    # Returns 32.0
fahrenheit_to_celsius(32)   # Returns 0.0
celsius_to_kelvin(0)        # Returns 273.15
convert_temperature(100, 'C', 'F')  # Returns 212.0
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

## Solution

```python
ABSOLUTE_ZERO_C = -273.15
ABSOLUTE_ZERO_F = -459.67
ABSOLUTE_ZERO_K = 0.0


def _check_celsius(celsius: float) -> None:
    if celsius < ABSOLUTE_ZERO_C:
        raise ValueError(f"{celsius}°C is below absolute zero")


def celsius_to_fahrenheit(celsius: float) -> float:
    _check_celsius(celsius)
    return celsius * 9 / 5 + 32


def fahrenheit_to_celsius(fahrenheit: float) -> float:
    if fahrenheit < ABSOLUTE_ZERO_F:
        raise ValueError(f"{fahrenheit}°F is below absolute zero")
    return (fahrenheit - 32) * 5 / 9


def celsius_to_kelvin(celsius: float) -> float:
    _check_celsius(celsius)
    # Rounded because 0.1 + 273.15 in binary floating point is not exact, and
    # the conversions are compared for equality.
    return round(celsius + 273.15, 10)


def kelvin_to_celsius(kelvin: float) -> float:
    if kelvin < ABSOLUTE_ZERO_K:
        raise ValueError(f"{kelvin}K is below absolute zero")
    return round(kelvin - 273.15, 10)


_TO_CELSIUS = {
    "C": lambda value: value,
    "F": fahrenheit_to_celsius,
    "K": kelvin_to_celsius,
}

_FROM_CELSIUS = {
    "C": lambda value: value,
    "F": celsius_to_fahrenheit,
    "K": celsius_to_kelvin,
}


def convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
    source = from_unit.upper()
    target = to_unit.upper()

    if source not in _TO_CELSIUS:
        raise ValueError(f"Unknown unit: {from_unit}")
    if target not in _FROM_CELSIUS:
        raise ValueError(f"Unknown unit: {to_unit}")

    # Going through Celsius keeps this to six conversions instead of nine, and
    # means the absolute-zero checks only have to live in one place per unit.
    celsius = _TO_CELSIUS[source](value)
    return _FROM_CELSIUS[target](celsius)
```
