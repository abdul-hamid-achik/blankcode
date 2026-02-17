---
title: "Error Handling Patterns"
slug: "go-error-handling-patterns"
description: "Master Go's error handling with wrapping, sentinel errors, custom types, and recovery."
track: "go"
order: 4
difficulty: "intermediate"
tags: ["errors", "error-handling", "patterns", "wrapping", "sentinel-errors"]
---

# Error Handling Patterns

Go takes a different approach to errors than most languages. There are no exceptions, no try/catch blocks. Instead, errors are values — returned from functions and handled explicitly by the caller. This design leads to code that is verbose but predictable, and makes the error path visible at every step.

## The Error Interface

In Go, an error is any type that implements the built-in `error` interface:

```go
type error interface {
    Error() string
}
```

The standard library provides `errors.New` and `fmt.Errorf` for creating simple errors:

```go
package main

import (
    "errors"
    "fmt"
)

func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

func main() {
    result, err := divide(10, 0)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println("Result:", result)
}
```

The `if err != nil` pattern is the cornerstone of Go error handling. It may seem repetitive, but it makes the control flow obvious — you always know where errors are checked.

## Wrapping Errors with fmt.Errorf

When an error passes through multiple layers, wrapping adds context so you can trace it back to its origin. Use `%w` to wrap an error while preserving the original.

```go
package main

import (
    "errors"
    "fmt"
    "os"
)

func readConfig(path string) ([]byte, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("readConfig(%s): %w", path, err)
    }
    return data, nil
}

func loadApp() error {
    _, err := readConfig("/etc/app/config.json")
    if err != nil {
        return fmt.Errorf("loadApp: %w", err)
    }
    return nil
}

func main() {
    err := loadApp()
    if err != nil {
        fmt.Println(err)
        // loadApp: readConfig(/etc/app/config.json): open /etc/app/config.json: no such file or directory

        // Unwrap to check the root cause
        if errors.Is(err, os.ErrNotExist) {
            fmt.Println("Config file not found")
        }
    }
}
```

The `%w` verb wraps the error, creating a chain. Use `%v` instead if you want to include the error text without wrapping (which prevents `errors.Is` and `errors.As` from seeing the original).

## errors.Is and errors.As

`errors.Is` checks whether any error in the chain matches a target value. `errors.As` checks whether any error in the chain matches a target type.

```go
package main

import (
    "errors"
    "fmt"
    "io/fs"
    "os"
)

func main() {
    _, err := os.Open("/nonexistent")
    if err == nil {
        return
    }

    // errors.Is — compare against a known sentinel
    if errors.Is(err, os.ErrNotExist) {
        fmt.Println("File does not exist")
    }

    // errors.As — extract a specific error type
    var pathErr *fs.PathError
    if errors.As(err, &pathErr) {
        fmt.Println("Failed path:", pathErr.Path)
        fmt.Println("Operation:", pathErr.Op)
    }
}
```

Always use `errors.Is` instead of `==` and `errors.As` instead of type assertions when checking errors. These functions traverse the entire wrap chain, while direct comparison only checks the outermost error.

## Sentinel Errors

Sentinel errors are package-level variables that represent specific, well-known failure conditions. They act as constants that callers can check with `errors.Is`.

```go
package main

import (
    "errors"
    "fmt"
)

// Sentinel errors — exported for callers to check
var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrConflict     = errors.New("conflict")
)

type UserStore struct {
    users map[int]string
}

func (s *UserStore) GetUser(id int) (string, error) {
    name, ok := s.users[id]
    if !ok {
        return "", fmt.Errorf("GetUser(%d): %w", id, ErrNotFound)
    }
    return name, nil
}

func main() {
    store := &UserStore{users: map[int]string{1: "Alice"}}

    _, err := store.GetUser(99)
    if errors.Is(err, ErrNotFound) {
        fmt.Println("User not found — show 404 page")
    }
}
```

Name sentinel errors with an `Err` prefix. Keep their messages short and generic — the wrapping context from `fmt.Errorf` provides the specifics.

## Custom Error Types

When you need to carry structured data with an error, define a custom type that implements the `error` interface.

```go
package main

import (
    "errors"
    "fmt"
)

type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Message)
}

func validateAge(age int) error {
    if age < 0 {
        return &ValidationError{Field: "age", Message: "must be non-negative"}
    }
    if age > 150 {
        return &ValidationError{Field: "age", Message: "unrealistic value"}
    }
    return nil
}

func processForm(age int) error {
    if err := validateAge(age); err != nil {
        return fmt.Errorf("processForm: %w", err)
    }
    return nil
}

func main() {
    err := processForm(-5)
    if err != nil {
        fmt.Println(err) // processForm: validation failed on age: must be non-negative

        var valErr *ValidationError
        if errors.As(err, &valErr) {
            fmt.Printf("Invalid field: %s\n", valErr.Field)
        }
    }
}
```

Custom error types shine when callers need to inspect error details beyond just the message — HTTP status codes, field names, error codes, and retry information.

## errors.Join (Go 1.20+)

When you need to combine multiple independent errors — for example, when validating several fields or closing multiple resources — use `errors.Join`.

```go
package main

import (
    "errors"
    "fmt"
)

func validateForm(name string, age int) error {
    var errs []error

    if name == "" {
        errs = append(errs, fmt.Errorf("name: must not be empty"))
    }
    if age < 0 || age > 150 {
        errs = append(errs, fmt.Errorf("age: must be between 0 and 150"))
    }

    return errors.Join(errs...)
}

func main() {
    err := validateForm("", -5)
    if err != nil {
        fmt.Println(err)
        // name: must not be empty
        // age: must be between 0 and 150
    }
}
```

`errors.Join` returns nil when all errors are nil. The resulting error supports `errors.Is` and `errors.As` — it checks against every error in the joined set.

## Defer, Panic, and Recover

Go has `panic` for truly exceptional situations and `recover` for catching panics. But for normal error handling, always return errors instead of panicking.

The most idiomatic use of `recover` is in top-level handlers — for example, HTTP middleware that converts an unexpected panic from a third-party library into a 500 response instead of crashing the server.

```go
package main

import (
    "fmt"
    "log"
    "net/http"
)

// recoveryMiddleware catches panics from handlers and returns a 500
func recoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                log.Printf("panic recovered: %v", err)
                http.Error(w, "Internal Server Error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}

// A handler that might panic due to a third-party library bug
func riskyHandler(w http.ResponseWriter, r *http.Request) {
    // Simulating a panic from a library you don't control
    panic("unexpected nil pointer in template engine")
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/risky", riskyHandler)

    wrapped := recoveryMiddleware(mux)
    fmt.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", wrapped))
}
```

Use `panic` only for programming errors — situations that should never happen if the code is correct (like an out-of-range index in a function that validates its input). Use `recover` in top-level handlers to prevent one bad request from bringing down the entire server. Never use panic/recover as a substitute for returning errors.

## Error Handling in Goroutines

Goroutines cannot return values to their caller. To propagate errors from a goroutine, send them through a channel. This bridges nicely with the concurrency patterns from the [Concurrency with Goroutines](/tutorials/go-concurrency-with-goroutines) tutorial.

```go
package main

import (
    "fmt"
    "math/rand"
)

type Result struct {
    Value int
    Err   error
}

func fetchFromService(id int, results chan<- Result) {
    // Simulate a service call that might fail
    if rand.Intn(3) == 0 {
        results <- Result{Err: fmt.Errorf("service %d: connection refused", id)}
        return
    }
    results <- Result{Value: id * 10}
}

func main() {
    results := make(chan Result, 3)

    for i := 1; i <= 3; i++ {
        go fetchFromService(i, results)
    }

    for i := 0; i < 3; i++ {
        r := <-results
        if r.Err != nil {
            fmt.Println("Error:", r.Err)
        } else {
            fmt.Println("Got:", r.Value)
        }
    }
}
```

The `Result` struct pattern (sometimes called an "either" type) bundles a value and an error together, mirroring Go's multiple-return convention for use with channels.

## Best Practices

A few guidelines for writing idiomatic Go error handling:

- **Handle errors where you have context.** If you cannot add meaningful context, return the error unchanged.
- **Wrap with `%w` when callers might need to inspect the cause.** Use `%v` when you want to hide the implementation detail.
- **Never ignore errors silently.** If you intentionally discard an error, leave a comment explaining why.
- **Keep sentinel errors in the package that owns the concept.** A `storage` package defines `ErrNotFound`, not the HTTP handler.
- **Prefer returning errors over panicking.** The only common exception is `Must`-prefixed functions (like `regexp.MustCompile`) that panic on errors that would indicate a programming bug.

```go
// Bad — error ignored silently
data, _ := os.ReadFile("config.json")

// Good — explicit decision with comment
data, err := os.ReadFile("config.json")
if err != nil {
    // Fall back to default configuration
    data = defaultConfig
}
```

## Practice

Head over to the [Go track](/tracks/go) to practice error handling with interactive exercises. Work through creating custom error types, wrapping errors with context, and using `errors.Is` and `errors.As` to inspect error chains.

## What's Next?

With error handling mastered, you have a solid foundation in Go. Revisit any of the earlier tutorials or explore the [Go track](/tracks/go) for hands-on exercises that bring all these concepts together.
