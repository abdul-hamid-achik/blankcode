---
slug: ru-challenge-001
title: 'Challenge: Build an Option Utilities Module'
description: Implement helper functions for working with Rust's Option type.
difficulty: beginner
type: challenge
tags:
  - options
  - enums
  - generics
---

# Challenge: Option Utilities

## Requirements

Create a module with utility functions for `Option<T>`:

1. **is_some_and<T, F>(opt: Option<T>, f: F) -> bool** - Returns true if Some and predicate returns true
2. **zip_options<T, U>(opt1: Option<T>, opt2: Option<U>) -> Option<(T, U)>** - Combines two Options
3. **first_some<T>(opts: &[Option<T>]) -> Option<&T>** - Returns first Some value in slice
4. **count_some<T>(opts: &[Option<T>]) -> usize** - Counts number of Some values
5. **flatten_options<T>(opts: &[Option<Option<T>>]) -> Option<T>** - Flattens nested options

## Constraints

- Use generics where appropriate
- Follow Rust idioms and best practices
- Handle edge cases (empty slices, all Nones, etc.)
- Don't use unwrap() - handle all cases explicitly

## Example Usage

```rust
is_some_and(Some(5), |x| x > 3)  // Returns true
zip_options(Some(1), Some(2))     // Returns Some((1, 2))
count_some(&[Some(1), None, Some(2)]) // Returns 2
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
    fn test_is_some_and_some_true() {
        assert!(is_some_and(Some(5), |x| x > 3));
    }

    #[test]
    fn test_is_some_and_some_false() {
        assert!(!is_some_and(Some(2), |x| x > 3));
    }

    #[test]
    fn test_is_some_and_none() {
        assert!(!is_some_and(None::<i32>, |x| x > 3));
    }

    #[test]
    fn test_zip_options_both_some() {
        assert_eq!(zip_options(Some(1), Some(2)), Some((1, 2)));
    }

    #[test]
    fn test_zip_options_one_none() {
        assert_eq!(zip_options(Some(1), None::<i32>), None);
    }

    #[test]
    fn test_zip_options_both_none() {
        assert_eq!(zip_options(None::<i32>, None::<i32>), None);
    }

    #[test]
    fn test_first_some_found() {
        let opts = [None, Some(1), Some(2)];
        assert_eq!(first_some(&opts), Some(&1));
    }

    #[test]
    fn test_first_some_not_found() {
        let opts: [Option<i32>; 2] = [None, None];
        assert_eq!(first_some(&opts), None);
    }

    #[test]
    fn test_first_some_empty() {
        let opts: [Option<i32>; 0] = [];
        assert_eq!(first_some(&opts), None);
    }

    #[test]
    fn test_count_some() {
        let opts = [Some(1), None, Some(2), None, Some(3)];
        assert_eq!(count_some(&opts), 3);
    }

    #[test]
    fn test_count_some_all_none() {
        let opts: [Option<i32>; 3] = [None, None, None];
        assert_eq!(count_some(&opts), 0);
    }

    #[test]
    fn test_count_some_empty() {
        let opts: [Option<i32>; 0] = [];
        assert_eq!(count_some(&opts), 0);
    }
}
```
