---
slug: go-challenge-001
title: 'Challenge: Build a String Reverser'
description: Implement multiple string reversal functions with proper error handling.
difficulty: beginner
type: challenge
tags:
  - strings
  - functions
  - basics
---

# Challenge: String Reverser

## Requirements

Create a string manipulation package with the following functions:

1. **Reverse(s string) string** - Reverses a string
2. **ReverseWords(s string) string** - Reverses the order of words (not characters)
3. **IsPalindrome(s string) bool** - Checks if a string is a palindrome (case-insensitive, ignores spaces)
4. **CountVowels(s string) int** - Counts the number of vowels in a string

## Constraints

- Handle empty strings gracefully
- Preserve original case for Reverse
- Words are separated by single spaces
- Palindrome check should ignore case and spaces
- Vowels are: a, e, i, o, u (case-insensitive)

## Example Usage

```go
Reverse("hello")           // Returns "olleh"
ReverseWords("hello world") // Returns "world hello"
IsPalindrome("A man a plan a canal Panama") // Returns true
CountVowels("Hello World")  // Returns 3
```

Write your complete implementation below:

```go
package main

// Your implementation here
```

## Tests

```go
package main

import "testing"

func TestReverse(t *testing.T) {
    tests := []struct {
        input    string
        expected string
    }{
        {"hello", "olleh"},
        {"Go", "oG"},
        {"", ""},
        {"a", "a"},
        {"12345", "54321"},
    }

    for _, tt := range tests {
        result := Reverse(tt.input)
        if result != tt.expected {
            t.Errorf("Reverse(%q) = %q; expected %q", tt.input, result, tt.expected)
        }
    }
}

func TestReverseWords(t *testing.T) {
    tests := []struct {
        input    string
        expected string
    }{
        {"hello world", "world hello"},
        {"Go is awesome", "awesome is Go"},
        {"", ""},
        {"single", "single"},
        {"a b c", "c b a"},
    }

    for _, tt := range tests {
        result := ReverseWords(tt.input)
        if result != tt.expected {
            t.Errorf("ReverseWords(%q) = %q; expected %q", tt.input, result, tt.expected)
        }
    }
}

func TestIsPalindrome(t *testing.T) {
    tests := []struct {
        input    string
        expected bool
    }{
        {"racecar", true},
        {"A man a plan a canal Panama", true},
        {"hello", false},
        {"", true},
        {"a", true},
        {"Was it a car or a cat I saw", true},
    }

    for _, tt := range tests {
        result := IsPalindrome(tt.input)
        if result != tt.expected {
            t.Errorf("IsPalindrome(%q) = %v; expected %v", tt.input, result, tt.expected)
        }
    }
}

func TestCountVowels(t *testing.T) {
    tests := []struct {
        input    string
        expected int
    }{
        {"hello", 2},
        {"AEIOU", 5},
        {"xyz", 0},
        {"", 0},
        {"Hello World", 3},
    }

    for _, tt := range tests {
        result := CountVowels(tt.input)
        if result != tt.expected {
            t.Errorf("CountVowels(%q) = %d; expected %d", tt.input, result, tt.expected)
        }
    }
}
```
