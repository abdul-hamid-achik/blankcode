---
title: "Go Fundamentals"
slug: "go-fundamentals"
description: "Learn the building blocks of Go — packages, variables, functions, and control flow."
track: "go"
order: 1
difficulty: "beginner"
tags: ["basics", "variables", "functions", "control-flow", "slices", "maps", "pointers"]
---

# Go Fundamentals

Go is a statically typed, compiled language designed for simplicity and performance. Created at Google, it powers tools like Docker, Kubernetes, and Terraform. Its straightforward syntax and built-in concurrency make it an excellent choice for backend services, CLI tools, and systems programming.

## Running Go Code

To get started, initialize a module and run your code:

```
go mod init myproject
go run main.go
```

Every Go project needs a `go.mod` file created by `go mod init`. You can use `go run` to compile and execute in one step, or `go build` to produce a binary.

## Packages and Imports

Every Go file belongs to a package. The `main` package is special — it defines an executable program, and the `main` function is the entry point.

```go
package main

import (
    "fmt"
    "strings"
)

func main() {
    greeting := "hello, world"
    fmt.Println(strings.ToUpper(greeting))
}
```

The `import` statement brings in other packages. Go enforces that every import must be used — unused imports cause a compilation error. You can group imports with parentheses as shown above.

## Variables and Types

Go has several ways to declare variables. The `:=` short declaration is the most common inside functions.

```go
package main

import "fmt"

func main() {
    // Explicit type declaration
    var name string = "Alice"
    var age int = 30

    // Type inference with :=
    score := 95.5       // float64
    active := true      // bool

    // Multiple declarations
    var x, y int = 10, 20

    // Zero values (defaults when no value is assigned)
    var count int       // 0
    var label string    // ""
    var flag bool       // false

    fmt.Println(name, age, score, active)
    fmt.Println(x, y, count, label, flag)
}
```

Go's type system includes `int`, `float64`, `string`, `bool`, and more. Every type has a zero value — numeric types default to `0`, strings to `""`, and booleans to `false`.

## Constants and iota

Constants are declared with `const` and cannot be changed after assignment. The `iota` keyword generates sequential integer constants, which is useful for enum-like values.

```go
package main

import "fmt"

const Pi = 3.14159

const (
    StatusPending  = iota // 0
    StatusRunning         // 1
    StatusComplete        // 2
    StatusFailed          // 3
)

func main() {
    fmt.Println("Pi:", Pi)
    fmt.Println("Pending:", StatusPending)
    fmt.Println("Running:", StatusRunning)
    fmt.Println("Complete:", StatusComplete)
}
```

Each `const` block resets `iota` to 0. Within a block, `iota` increments by one for each constant. This is the idiomatic Go way to define enumerations.

## Type Conversions

Go requires explicit type conversions — there is no implicit casting between types, even between `int` and `float64`.

```go
package main

import "fmt"

func main() {
    myFloat := 3.7
    myInt := int(myFloat)       // 3 (truncates, does not round)
    fmt.Println(myInt)

    count := 42
    precise := float64(count)   // 42.0
    fmt.Println(precise)

    var small int32 = 100
    var big int64 = int64(small) // explicit even between int sizes
    fmt.Println(big)
}
```

This strictness prevents subtle bugs that arise from implicit conversions in other languages. If you need to convert, state it explicitly.

## Arrays vs Slices

Go has both arrays and slices. Arrays have a fixed size that is part of the type — `[3]int` and `[5]int` are different types. Slices are the flexible, dynamically-sized view into arrays that you will use almost everywhere.

```go
// Array — fixed size, rarely used directly
var arr [3]int = [3]int{1, 2, 3}

// Slice — dynamic, backed by an array
nums := []int{1, 2, 3}
nums = append(nums, 4)
```

In practice, you will almost always use slices rather than arrays.

## Slices and Maps

Slices are Go's dynamic arrays. Maps are key-value stores, similar to dictionaries or hash maps in other languages.

```go
package main

import "fmt"

func main() {
    // Slices
    numbers := []int{10, 20, 30}
    numbers = append(numbers, 40)
    fmt.Println(numbers)        // [10 20 30 40]
    fmt.Println(numbers[1:3])   // [20 30]
    fmt.Println(len(numbers))   // 4

    // Maps
    scores := map[string]int{
        "Alice": 95,
        "Bob":   87,
    }
    scores["Carol"] = 92
    fmt.Println(scores["Alice"]) // 95

    // Check if a key exists
    val, exists := scores["Dave"]
    fmt.Println(val, exists)     // 0 false
}
```

Slices are backed by arrays but grow automatically with `append`. Maps return a zero value for missing keys, so use the two-value form to check existence.

## Functions

Functions in Go can return multiple values, which is a pattern used heavily for error handling.

```go
package main

import (
    "errors"
    "fmt"
)

// Simple function
func add(a, b int) int {
    return a + b
}

// Multiple return values
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

// Named return values
func swap(x, y string) (first, second string) {
    first = y
    second = x
    return
}

func main() {
    fmt.Println(add(3, 5))

    result, err := divide(10, 3)
    if err != nil {
        fmt.Println("Error:", err)
    } else {
        fmt.Printf("Result: %.2f\n", result)
    }

    a, b := swap("hello", "world")
    fmt.Println(a, b) // world hello
}
```

Named return values are pre-declared and can be returned with a bare `return` statement. Use them sparingly — they improve clarity for short functions but can reduce readability in longer ones.

## Control Flow

Go keeps control flow minimal. There is no `while` keyword — `for` handles all looping. The `switch` statement does not fall through by default.

```go
package main

import "fmt"

func main() {
    // If-else (no parentheses needed)
    x := 42
    if x > 0 {
        fmt.Println("positive")
    } else if x < 0 {
        fmt.Println("negative")
    } else {
        fmt.Println("zero")
    }

    // If with short statement
    if val := x * 2; val > 50 {
        fmt.Println("large:", val)
    }

    // For loop (the only loop in Go)
    for i := 0; i < 5; i++ {
        fmt.Println(i)
    }

    // While-style loop
    n := 1
    for n < 100 {
        n *= 2
    }
    fmt.Println(n)

    // Range over a slice
    colors := []string{"red", "green", "blue"}
    for index, color := range colors {
        fmt.Printf("%d: %s\n", index, color)
    }

    // Switch (no fall-through by default)
    day := "Tuesday"
    switch day {
    case "Monday", "Tuesday", "Wednesday", "Thursday", "Friday":
        fmt.Println("Weekday")
    case "Saturday", "Sunday":
        fmt.Println("Weekend")
    default:
        fmt.Println("Unknown")
    }
}
```

The `if` statement can include a short variable declaration before the condition. This scopes the variable to the `if`/`else` block, keeping the surrounding scope clean.

## Pointers Basics

Pointers hold the memory address of a value. They let you pass references to data without copying it.

```go
package main

import "fmt"

func increment(val *int) {
    *val++
}

func main() {
    x := 10
    fmt.Println(&x)   // memory address like 0xc0000b6010

    p := &x            // p is a pointer to x
    fmt.Println(*p)    // 10 (dereference the pointer)

    increment(&x)
    fmt.Println(x)     // 11
}
```

The `&` operator gets the address of a variable, and `*` dereferences a pointer. Go does not have pointer arithmetic, which eliminates an entire class of bugs common in C and C++.

## Practice

You now have the foundation to read and write basic Go programs. Head over to the [Go track](/tracks/go) to practice with interactive exercises. Start with simple variable declarations and function definitions, then work your way up to slices, maps, and multi-return functions.

## What's Next?

Once you are comfortable with the fundamentals, move on to [Structs and Interfaces](/tutorials/go-structs-and-interfaces) to learn how Go approaches object-oriented design without classes.
