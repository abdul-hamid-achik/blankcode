---
slug: go-error-handling-division
title: Safe Division with Error Handling
description: Learn how to create and handle errors in Go by implementing a safe division function that prevents division by zero.
difficulty: beginner
hints:
  - In Go, functions can return multiple values, including an error as the last return value
  - Use the `errors` package to create new error messages
  - Check if an error is not nil before using the result
  - The standard pattern is to return the zero value and an error when something goes wrong
tags:
  - error-handling
  - functions
  - errors
  - multiple-return-values
---

In Go, error handling is explicit and idiomatic. Functions that can fail return an error as their last return value. Let's implement a safe division function that handles the division by zero case.

Complete the code below to:
1. Import the necessary package for creating errors
2. Return an appropriate error when dividing by zero
3. Check for errors before using the result
4. Handle the error appropriately in the main function

```go
package main

import (
	___blank_start___"errors"___blank_end___
	"fmt"
)

// Divide performs division and returns an error if the divisor is zero
func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ___blank_start___errors.New("division by zero")___blank_end___
	}
	return a / b, nil
}

func main() {
	result, err := Divide(10, 2)
	___blank_start___if err != nil___blank_end___ {
		fmt.Println("Error:", err)
		return
	}
	fmt.Printf("Result: %.2f\n", result)

	result2, err2 := Divide(10, 0)
	if err2 != nil {
		___blank_start___fmt.Println("Error:", err2)___blank_end___
	} else {
		fmt.Printf("Result: %.2f\n", result2)
	}
}
```

## Tests

```go
package main

import "testing"

func TestDivideSuccess(t *testing.T) {
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
		t.Fatalf("expected error for division by zero")
	}
}
```
