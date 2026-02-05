---
slug: go-testing-and-tooling-basic-unit-test
title: Writing Your First Go Unit Test
description: Learn how to write basic unit tests in Go using the testing package and understand the testing file naming convention.
difficulty: beginner
hints:
  - Test files in Go must end with `_test.go`
  - Test functions must start with `Test` and take `*testing.T` as a parameter
  - Use `t.Errorf()` to report test failures with formatted messages
  - The `go test` command automatically discovers and runs tests
tags:
  - testing
  - unit-tests
  - tooling
  - test-driven-development
---

In this exercise, you'll write a basic unit test for a simple calculator function. Go has a built-in testing package that makes it easy to write and run tests.

Complete the test file below to verify that the `Add` function works correctly. You'll need to:
1. Name the test file following Go conventions
2. Create a proper test function signature
3. Report test failures when the actual result doesn't match expected

```go
// calculator.go
package calculator

import ___blank_start___"testing"___blank_end___

func Add(a, b int) int {
    return a + b
}

// ___blank_start___calculator_test.go___blank_end___

package calculator

func ___blank_start___TestAdd___blank_end___(t *testing.T) {
    result := Add(2, 3)
    expected := 5
    
    if result != expected {
        ___blank_start___t.Errorf___blank_end___("Add(2, 3) = %d; want %d", result, expected)
    }
}
```

## Tests

```go
package calculator

import "testing"

func TestAddFunction(t *testing.T) {
	if Add(2, 3) != 5 {
		t.Fatalf("expected Add(2, 3) to be 5")
	}
}

func TestStudentTestExists(t *testing.T) {
	var _ func(*testing.T) = TestAdd
}
```
