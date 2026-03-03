---
slug: ru-challenge-002
title: 'Challenge: Build a Safe Division Calculator'
description: Implement error-handling division operations using Rust's Result type.
difficulty: intermediate
type: challenge
tags:
  - error-handling
  - result
  - traits
---

# Challenge: Safe Division Calculator

## Requirements

Create a division module that handles errors gracefully:

1. **DivisionError enum** - With variants: `DivisionByZero`, `Overflow`, `InvalidInput`
2. **divide(a: f64, b: f64) -> Result<f64, DivisionError>** - Safe division
3. **safe_divide(a: f64, b: f64) -> Option<f64>** - Returns None on error
4. **divide_all(nums: &[f64], divisor: f64) -> Result<Vec<f64>, DivisionError>** - Divide all numbers
5. **checked_divide(a: f64, b: f64) -> Result<f64, DivisionError>** - Also checks for overflow

## Constraints

- Implement `Display` and `std::error::Error` for `DivisionError`
- Handle division by zero
- Handle infinity results (overflow)
- Handle NaN inputs as invalid

## Example Usage

```rust
divide(10.0, 2.0)      // Ok(5.0)
divide(10.0, 0.0)      // Err(DivisionByZero)
safe_divide(10.0, 0.0) // None
```

Write your complete implementation below:

```rust
// Your implementation here
```

## Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_divide_normal() {
        assert_eq!(divide(10.0, 2.0), Ok(5.0));
    }

    #[test]
    fn test_divide_by_zero() {
        assert_eq!(divide(10.0, 0.0), Err(DivisionError::DivisionByZero));
    }

    #[test]
    fn test_divide_zero_numerator() {
        assert_eq!(divide(0.0, 5.0), Ok(0.0));
    }

    #[test]
    fn test_divide_negative() {
        assert_eq!(divide(-10.0, 2.0), Ok(-5.0));
    }

    #[test]
    fn test_safe_divide_some() {
        assert_eq!(safe_divide(10.0, 2.0), Some(5.0));
    }

    #[test]
    fn test_safe_divide_none() {
        assert_eq!(safe_divide(10.0, 0.0), None);
    }

    #[test]
    fn test_divide_all_success() {
        let nums = vec![10.0, 20.0, 30.0];
        assert_eq!(divide_all(&nums, 2.0), Ok(vec![5.0, 10.0, 15.0]));
    }

    #[test]
    fn test_divide_all_error() {
        let nums = vec![10.0, 20.0];
        assert_eq!(divide_all(&nums, 0.0), Err(DivisionError::DivisionByZero));
    }

    #[test]
    fn test_checked_divide_overflow() {
        // Division resulting in infinity should be an error
        let result = checked_divide(1.0, 0.00000000000000000000000000000000000001);
        assert!(result.is_err());
    }

    #[test]
    fn test_checked_divide_nan_input() {
        assert_eq!(checked_divide(f64::NAN, 2.0), Err(DivisionError::InvalidInput));
    }

    #[test]
    fn test_error_display() {
        let err = DivisionError::DivisionByZero;
        assert_eq!(format!("{}", err), "Division by zero");
    }
}
```
