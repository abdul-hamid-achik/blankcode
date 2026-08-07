---
title: "Structs and Interfaces"
slug: "go-structs-and-interfaces"
description: "How Go replaces classes: structs for data, methods attached via receivers, and interfaces satisfied implicitly by any type with the matching method set."
track: "go"
order: 2
difficulty: "intermediate"
tags: ["structs", "interfaces", "methods", "struct-tags", "composition"]
practice:
  concept: "structs-and-interfaces"
  label: "Structs and interfaces"
---

Go has no classes. It has structs, which hold data, methods, which are functions attached to a type after the fact, and interfaces, which are satisfied by having the right methods rather than by declaring intent. The three together cover most of what a class does — without an inheritance tree to design up front.

## Structs hold data; methods attach separately

A struct groups related fields under one type. There is no constructor syntax — the zero-value struct is a real, usable value, and every field you don't set gets its type's zero value.

```go
type User struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Age   int    `json:"age,omitempty"`
}

alice := User{Name: "Alice", Email: "alice@example.com", Age: 30}
var empty User // "" "" 0 — usable immediately, not "uninitialized"
```

Always use named fields. `User{"Bob", "bob@example.com", 25}` compiles today and silently assigns the wrong value to the wrong field the moment someone reorders or inserts a field — the compiler has no way to tell you the shape changed underneath a positional literal.

The backtick strings are struct tags — metadata read by reflection, most often by `encoding/json`. `json:"age,omitempty"` skips the field when it holds the zero value; `json:"-"` excludes it entirely, which is how a `Password` field stays off the wire without a second, JSON-only type.

::code-blank{lang="go" href="/tracks/go/structs-and-interfaces" label="practice structs and interfaces for real"}
---
code: |
  ___blank_start___type___blank_end___ User struct {
      Name string
      Age  int
  }
---
::

## Receivers: value copies, pointer mutates

A method is a function with a receiver argument, and the receiver's kind decides whether the method sees the original or a copy.

```go
type Rectangle struct {
	Width, Height float64
}

func (r Rectangle) Area() float64 {
	return r.Width * r.Height
}

func (r *Rectangle) Scale(factor float64) {
	r.Width *= factor
	r.Height *= factor
}
```

`Area` only reads the struct, so a value receiver is fine — Go copies a small struct without you noticing. `Scale` has to change the caller's data, so it needs a pointer receiver; with a value receiver it would mutate a copy that disappears the moment the method returns. Convention: once any method on a type needs a pointer receiver, give them all pointer receivers. A mixed set forces every reader to check each signature to know whether a call mutates.

## Interfaces are satisfied implicitly

There is no `implements` keyword. A type satisfies an interface by having the methods, full stop, which means the interface can live in the package that consumes a value rather than the one that defines it — the usual shape of a decoupled Go codebase.

```go
type Shape interface {
	Area() float64
}

type Circle struct{ Radius float64 }

func (c Circle) Area() float64 { return math.Pi * c.Radius * c.Radius }

func printArea(s Shape) {
	fmt.Println(s.Area())
}

printArea(Circle{Radius: 5}) // Circle satisfies Shape; nothing declares that anywhere
```

`any` is the empty interface — no methods required, so anything satisfies it. Extract the concrete type with a type switch, and use the two-value form for a direct assertion; the single-value form panics on a mismatch instead of telling you.

```go
func describe(i any) string {
	switch v := i.(type) {
	case int:
		return fmt.Sprintf("int: %d", v)
	case string:
		return fmt.Sprintf("string: %q", v)
	default:
		return fmt.Sprintf("other: %v", v)
	}
}
```

::code-blank{lang="go" href="/tracks/go/structs-and-interfaces" label="practice structs and interfaces for real"}
---
code: |
  func describe(i ___blank_start___any___blank_end___) string {
      return fmt.Sprintf("%v", i)
  }
---
::

Here is the one that costs people an afternoon the first time. An interface value is a pair — a concrete type and a value — and it is nil only when both halves are nil. A nil pointer of a concrete type, stored in an interface, is not a nil interface.

```go
type APIError struct{ Code int }

func (e *APIError) Error() string { return fmt.Sprintf("api error %d", e.Code) }

func call() *APIError {
	return nil // no error — looks fine so far
}

func run() error {
	var err *APIError = call()
	return err // a non-nil error interface holding a nil *APIError
}

if err := run(); err != nil {
	fmt.Println("failed:", err) // prints, even though call() never failed
}
```

`run` returns `error`. The value it returns has type half `*APIError` and value half `nil` — the pair is not the zero interface, so `err != nil` is true, and the caller takes the failure branch for a call that succeeded. Declare the local as `error` rather than the concrete pointer type, or skip the intermediate variable and return `nil` directly.

## Pointer receivers change which values satisfy an interface

A method set is computed per type. `*T`'s method set includes everything defined on both `T` and `*T`; `T`'s method set includes only what is defined on `T` directly.

```go
type Notifier interface {
	Notify() string
}

type EmailAlert struct{ Address string }

func (e *EmailAlert) Notify() string {
	return "sending to " + e.Address
}

var n Notifier = &EmailAlert{Address: "ops@example.com"} // compiles

// var n2 Notifier = EmailAlert{Address: "ops@example.com"}
// does not — EmailAlert has no Notify method; only *EmailAlert does.
```

`EmailAlert{}.Notify()` still compiles as a direct call, because Go automatically takes the address for you. But assign that same value to a `Notifier` variable and it fails, because the interface requires the method set to already include `Notify`, and a plain `EmailAlert` value's method set does not.

## Composition through embedding

Go favors composition over inheritance. Embedding a struct promotes its fields and methods to the outer type.

```go
type Address struct {
	City, State string
}

func (a Address) String() string {
	return fmt.Sprintf("%s, %s", a.City, a.State)
}

type Employee struct {
	Name string
	Address
}

emp := Employee{Name: "Alice", Address: Address{City: "Portland", State: "OR"}}
fmt.Println(emp.City)     // promoted field
fmt.Println(emp.String()) // promoted method
```

This is composition, not inheritance — there is no "is-a" relationship and no dynamic dispatch. If `Employee` defines its own `String` method, it replaces the promoted one entirely for `Employee` values. Nothing about embedding lets one version call the other, the way a `super` call would in a language with real inheritance.

::code-blank{lang="go" href="/tracks/go/structs-and-interfaces" label="practice structs and interfaces for real"}
---
code: |
  type Employee struct {
      Name string
      ___blank_start___Address___blank_end___
  }
---
::

## Where this bites

**Positional struct literals break silently when a field moves.** `User{"Bob", "bob@example.com", 25}` still compiles after someone reorders or inserts a field — it just assigns values to the wrong fields. Name the fields; there is no runtime or `go vet` check that catches the swap for you.

**A typed nil pointer, returned as an `error`, is not nil.** The interface pair holds a real type and a nil value, so `err != nil` passes for a call that succeeded. Declare the variable as the interface type, or return `nil` directly instead of routing it through a concrete-typed local.

**Mixed receivers produce a method set that only some call sites see.** A struct field, a slice element, or an interface variable may or may not have a pointer-receiver method available, depending on whether that particular value is addressable. Once one method on a type needs a pointer receiver, make them all pointer receivers and the question stops coming up.

**Embedding gives you promotion, not overriding.** Defining a method with the same name on the outer type fully replaces the promoted one — there is no way to get both. If you need to extend rather than replace, call the embedded field's method explicitly by name from inside the new one, such as `e.Address.String()`.
