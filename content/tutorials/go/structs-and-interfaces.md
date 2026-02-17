---
title: "Structs and Interfaces"
slug: "go-structs-and-interfaces"
description: "Master Go's approach to data modeling with structs, methods, and interfaces."
track: "go"
order: 2
difficulty: "intermediate"
tags: ["structs", "interfaces", "methods", "struct-tags", "composition"]
---

# Structs and Interfaces

Go does not have classes, but it has something arguably more flexible: structs and interfaces. Structs define data, methods attach behavior, and interfaces enable polymorphism — all without inheritance hierarchies.

## Defining Structs

A struct groups related fields together. Think of it as a lightweight class without methods (those come separately).

```go
package main

import "fmt"

type User struct {
    Name  string
    Email string
    Age   int
}

func main() {
    // Named fields
    alice := User{Name: "Alice", Email: "alice@example.com", Age: 30}

    // Positional (fragile — avoid in production code)
    bob := User{"Bob", "bob@example.com", 25}

    // Zero-value struct
    var empty User
    fmt.Println(empty.Name) // ""

    // Modify fields directly
    alice.Age = 31
    fmt.Println(alice)
    fmt.Println(bob)
}
```

Always prefer named field initialization. Positional initialization breaks when fields are reordered or new fields are added.

## Struct Tags

Struct tags are metadata strings attached to struct fields. They are used extensively for JSON serialization, database mapping, and validation.

```go
package main

import (
    "encoding/json"
    "fmt"
)

type User struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Age      int    `json:"age,omitempty"`
    Password string `json:"-"` // excluded from JSON
}

func main() {
    u := User{Name: "Alice", Email: "alice@example.com", Age: 30, Password: "secret"}
    data, _ := json.Marshal(u)
    fmt.Println(string(data))
    // {"name":"Alice","email":"alice@example.com","age":30}

    // Unmarshal from JSON
    input := `{"name":"Bob","email":"bob@example.com"}`
    var u2 User
    json.Unmarshal([]byte(input), &u2)
    fmt.Println(u2.Name, u2.Email) // Bob bob@example.com
}
```

Tags follow the format `key:"value"`. Common tags include `json`, `db`, `xml`, and `validate`. The `omitempty` option skips zero-value fields during marshaling, and `"-"` excludes a field entirely.

## Methods with Receivers

Methods in Go are functions with a special receiver argument. The receiver ties the method to a type.

```go
package main

import "fmt"

type Rectangle struct {
    Width  float64
    Height float64
}

// Value receiver — gets a copy
func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

// Pointer receiver — can modify the original
func (r *Rectangle) Scale(factor float64) {
    r.Width *= factor
    r.Height *= factor
}

func main() {
    rect := Rectangle{Width: 10, Height: 5}
    fmt.Println("Area:", rect.Area()) // 50

    rect.Scale(2)
    fmt.Println("Scaled:", rect)       // {20 10}
    fmt.Println("Area:", rect.Area())  // 200
}
```

Use a **value receiver** when the method does not modify the struct and the struct is small. Use a **pointer receiver** when the method modifies the struct or the struct is large (to avoid copying). As a convention, if any method on a type uses a pointer receiver, all methods on that type should use pointer receivers.

## The NewXxx Constructor Pattern

Go does not have constructors, but by convention a function named `NewXxx` creates and returns an initialized value. This is the standard pattern for types that need setup beyond zero values.

```go
package main

import "fmt"

type Server struct {
    host string
    port int
}

func NewServer(host string, port int) *Server {
    if port <= 0 {
        port = 8080
    }
    return &Server{host: host, port: port}
}

func (s *Server) Address() string {
    return fmt.Sprintf("%s:%d", s.host, s.port)
}

func main() {
    srv := NewServer("localhost", 0)
    fmt.Println(srv.Address()) // localhost:8080
}
```

Returning a pointer from the constructor is idiomatic when the type has pointer-receiver methods or when you want to allow nil checks.

## Interfaces and Implicit Implementation

Interfaces in Go are satisfied implicitly. A type implements an interface simply by having the required methods — no `implements` keyword needed.

```go
package main

import (
    "fmt"
    "math"
)

type Shape interface {
    Area() float64
    Perimeter() float64
}

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return math.Pi * c.Radius * c.Radius
}

func (c Circle) Perimeter() float64 {
    return 2 * math.Pi * c.Radius
}

type Square struct {
    Side float64
}

func (s Square) Area() float64 {
    return s.Side * s.Side
}

func (s Square) Perimeter() float64 {
    return 4 * s.Side
}

func printShapeInfo(s Shape) {
    fmt.Printf("Area: %.2f, Perimeter: %.2f\n", s.Area(), s.Perimeter())
}

func main() {
    c := Circle{Radius: 5}
    sq := Square{Side: 4}

    printShapeInfo(c)  // Area: 78.54, Perimeter: 31.42
    printShapeInfo(sq) // Area: 16.00, Perimeter: 16.00
}
```

This implicit satisfaction is powerful. You can define interfaces where they are consumed, not where they are implemented. A package can accept an interface that types from entirely different packages satisfy, enabling loose coupling.

## Pointer Receivers and Interface Satisfaction

An important subtlety: when a method is defined on a pointer receiver (`*T`), only a pointer to T satisfies the interface — a value of T does not.

```go
package main

import "fmt"

type Notifier interface {
    Notify() string
}

type EmailAlert struct {
    Address string
}

// Pointer receiver method
func (e *EmailAlert) Notify() string {
    return "Sending email to " + e.Address
}

func main() {
    alert := &EmailAlert{Address: "admin@example.com"}
    // This works — alert is a *EmailAlert
    var n Notifier = alert
    fmt.Println(n.Notify())

    // This would NOT compile:
    // var n2 Notifier = EmailAlert{Address: "user@example.com"}
    // Because EmailAlert (value) does not implement Notifier,
    // only *EmailAlert (pointer) does.
}
```

You can call a pointer-receiver method on a value directly (`alert.Notify()` works even if `alert` is not a pointer, because Go auto-takes the address). But an interface variable holding a value (not a pointer) cannot dispatch to pointer-receiver methods. This is because the interface may hold a copy that cannot be safely addressed.

## The Empty Interface and Type Assertions

The empty interface `interface{}` (or its alias `any` in Go 1.18+) can hold any value. Use type assertions to extract the concrete type.

```go
package main

import "fmt"

func describe(i any) string {
    switch v := i.(type) {
    case int:
        return fmt.Sprintf("integer: %d", v)
    case string:
        return fmt.Sprintf("string: %q", v)
    case bool:
        return fmt.Sprintf("boolean: %t", v)
    default:
        return fmt.Sprintf("unknown: %v", v)
    }
}

func main() {
    fmt.Println(describe(42))
    fmt.Println(describe("hello"))
    fmt.Println(describe(true))

    // Direct type assertion
    var val any = "Go is great"
    str, ok := val.(string)
    if ok {
        fmt.Println("String value:", str)
    }
}
```

Always use the two-value form `val, ok := i.(Type)` for type assertions. The single-value form panics if the assertion fails.

## Embedding and Composition

Go favors composition over inheritance. Struct embedding lets you build complex types by combining simpler ones.

```go
package main

import "fmt"

type Address struct {
    Street string
    City   string
    State  string
}

func (a Address) FullAddress() string {
    return fmt.Sprintf("%s, %s, %s", a.Street, a.City, a.State)
}

type Employee struct {
    Name string
    Address              // embedded struct
    Department string
}

func main() {
    emp := Employee{
        Name:       "Alice",
        Department: "Engineering",
        Address: Address{
            Street: "123 Main St",
            City:   "Portland",
            State:  "OR",
        },
    }

    // Access embedded fields directly
    fmt.Println(emp.City)           // Portland

    // Promoted methods work too
    fmt.Println(emp.FullAddress())  // 123 Main St, Portland, OR
}
```

Embedding promotes all fields and methods of the inner type to the outer type. This is not inheritance — there is no "is-a" relationship. The `Employee` has an `Address`, and its fields are accessible without the extra level of nesting.

## Interface Composition

Just as you can embed structs, you can compose interfaces from smaller ones. This pattern is used extensively in the standard library.

```go
package main

import (
    "fmt"
    "strings"
)

// Small, focused interfaces
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

// Composed interface
type ReadWriter interface {
    Reader
    Writer
}

// A type that satisfies ReadWriter
type Buffer struct {
    data []byte
}

func (b *Buffer) Read(p []byte) (int, error) {
    n := copy(p, b.data)
    b.data = b.data[n:]
    return n, nil
}

func (b *Buffer) Write(p []byte) (int, error) {
    b.data = append(b.data, p...)
    return len(p), nil
}

func main() {
    var rw ReadWriter = &Buffer{}
    rw.Write([]byte("hello"))

    buf := make([]byte, 5)
    rw.Read(buf)
    fmt.Println(strings.TrimRight(string(buf), "\x00")) // hello
}
```

The `io.ReadWriter` interface in the standard library is exactly this — a combination of `io.Reader` and `io.Writer`. Design small, focused interfaces and compose them when you need broader contracts.

## Common Interface Patterns

The Go standard library defines several small interfaces that are worth knowing:

- `fmt.Stringer` — implement `String() string` for custom print output
- `error` — implement `Error() string` for custom error types
- `io.Reader` / `io.Writer` — the foundation of Go's I/O model
- `sort.Interface` — implement `Len`, `Less`, `Swap` for custom sorting

```go
package main

import "fmt"

type Temperature struct {
    Celsius float64
}

func (t Temperature) String() string {
    return fmt.Sprintf("%.1f°C", t.Celsius)
}

func main() {
    temp := Temperature{Celsius: 36.6}
    fmt.Println(temp) // 36.6°C
}
```

## Practice

Head over to the [Go track](/tracks/go) to practice with interactive exercises on structs, methods, and interfaces. Try defining your own types and making them satisfy standard library interfaces.

## What's Next?

Now that you understand how Go models data and behavior, move on to [Concurrency with Goroutines](/tutorials/go-concurrency-with-goroutines) to learn how Go handles parallelism as a first-class feature.
