---
slug: go-errorhandling-divide-safely
title: Safe Division with Error Handling
description: Learn to handle errors in Go by implementing a safe division function that returns errors for invalid operations
difficulty: beginner
hints:
  - In Go, functions can return multiple values, including an error as the last return value
  - Use fmt.Errorf() to create a new error with a descriptive message
  - Check if an error is nil before using the result value
  - The convention is to return the zero value along with an error when something goes wrong
tags:
  - error-handling
  - functions
  - multiple-return-values
---

In Go, error handling is explicit and idiomatic. Functions that can fail return an error as their last return value. Your task is to implement a `Divide` function that safely divides two numbers and returns an error when division by zero is attempted.

Complete the code by filling in the blanks to properly handle the division by zero error case.

```typescript
package main

import (
	"fmt"
)

// Divide performs division and returns an error if the divisor is zero
func Divide(a, b float64) (float64, error) {
	if b == 0 {
		// Return zero value and an error for division by zero
		return 0, ___blank_start___fmt.Errorf("cannot divide by zero")___blank_end___
	}
	return a / b, ___blank_start___nil___blank_end___
}

func main() {
	// Attempt valid division
	result, err := Divide(10, 2)
	if ___blank_start___err != nil___blank_end___ {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Result:", result)
	}

	// Attempt division by zero
	result, err = Divide(10, 0)
	if ___blank_start___err != nil___blank_end___ {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Result:", result)
	}
}
```

## Tests

```go
package main

import "testing"

func TestDivideOk(t *testing.T) {
result, err := Divide(10, 2)
if err != nil {
t.Fatalf("unexpected error: %v", err)
}
if result != 5 {
t.Fatalf("expected 5, got %.2f", result)
}
}

func TestDivideByZero(t *testing.T) {
_, err := Divide(10, 0)
if err == nil {
t.Fatalf("expected error for divide by zero")
}
}
```
