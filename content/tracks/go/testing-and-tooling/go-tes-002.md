---
slug: go-testing-and-tooling-basics
title: Writing Your First Go Tests
description: Learn how to write basic unit tests in Go using the testing package and understand the structure of test files.
difficulty: beginner
hints:
  - Test files in Go must end with "_test.go"
  - Test functions must start with "Test" and take a *testing.T parameter
  - Use t.Errorf() to report test failures with formatted messages
  - The go test command runs all tests in the current package
tags:
  - testing
  - unit-tests
  - tooling
---

In Go, testing is built into the language through the `testing` package. Test files are placed alongside your code with a `_test.go` suffix. Each test function must start with `Test` and accept a pointer to `testing.T`.

Your task is to complete a simple calculator test suite that verifies basic arithmetic operations.

```go
package calculator

import (
	___blank_start___ "testing" ___blank_end___
)

// Add returns the sum of two integers
func Add(a, b int) int {
	return a + b
}

// Multiply returns the product of two integers
func Multiply(a, b int) int {
	return a * b
}

// TestAdd verifies the Add function works correctly
func ___blank_start___ TestAdd ___blank_end___(t *testing.T) {
	result := Add(2, 3)
	expected := 5
	
	if result != expected {
		t.___blank_start___ Errorf ___blank_end___("Add(2, 3) = %d; want %d", result, expected)
	}
}

// TestMultiply verifies the Multiply function works correctly
func TestMultiply(t *___blank_start___ testing.T ___blank_end___) {
	result := Multiply(4, 5)
	expected := 20
	
	if result != expected {
		t.Errorf("Multiply(4, 5) = %d; want %d", result, expected)
	}
}
```

## Tests

```go
package calculator

import "testing"

func TestAddValues(t *testing.T) {
	if Add(2, 3) != 5 {
		t.Fatalf("expected Add(2, 3) to be 5")
	}
	if Add(-1, 1) != 0 {
		t.Fatalf("expected Add(-1, 1) to be 0")
	}
}

func TestMultiplyValues(t *testing.T) {
	if Multiply(4, 5) != 20 {
		t.Fatalf("expected Multiply(4, 5) to be 20")
	}
	if Multiply(-2, 3) != -6 {
		t.Fatalf("expected Multiply(-2, 3) to be -6")
	}
}

func TestStudentTestsExist(t *testing.T) {
	var _ func(*testing.T) = TestAdd
	var _ func(*testing.T) = TestMultiply
}
```
