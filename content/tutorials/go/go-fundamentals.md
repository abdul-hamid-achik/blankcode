---
title: "Go Fundamentals"
slug: "go-fundamentals"
description: "The parts of Go you touch in every file: packages, typed variables, slice and map internals, and functions that return an error alongside their result."
track: "go"
order: 1
difficulty: "beginner"
tags: ["basics", "variables", "functions", "control-flow", "slices", "maps", "pointers"]
practice:
  concept: "structs-and-interfaces"
  label: "Structs and interfaces"
---

Go has a small surface on purpose: one way to loop, one keyword for declaring almost anything, and a handful of built-in types that get you through most programs without reaching for a framework. This tutorial is that surface — packages, variables, slices, maps, and functions — the vocabulary the rest of the Go track assumes you already have.

## Packages and the module boundary

Every Go file declares which package it belongs to. `package main` is the one exception that matters early: it marks an executable, and `main.main` is where the program starts. Everything else is a library package, imported by its path.

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

`go mod init myproject` creates the `go.mod` that names your module; `go run main.go` compiles and runs in one step. The compiler is strict about imports in both directions — an unused import is a build error, not a warning, and so is an unused local variable. Nothing lingers by accident.

## Variables, and why zero values matter

`var name string = "Alice"` and `name := "Alice"` do the same thing; `:=` infers the type and is the one you will write inside functions. `var` is for package-level declarations, or when you want the zero value on purpose.

```go
var count int         // 0
var label string      // ""
var ok bool            // false
var prices []float64  // nil, but usable — see below
```

Every type in Go has a zero value, and the zero value is a real, working value, not an "uninitialized" marker you have to check for before using it. A zero-value `sync.Mutex` is already unlocked. A zero-value `bytes.Buffer` is already empty and ready to write to. Design your own types the same way when you can — a struct whose zero value behaves sensibly needs no constructor.

::code-blank{lang="go" href="/tracks/go/structs-and-interfaces" label="practice structs and interfaces for real"}
---
code: |
  ___blank_start___var___blank_end___ count int
  fmt.Println(count) // 0
---
::

## Slices are a header, not an array

A slice is three numbers — a pointer into a backing array, a length, and a capacity — not the array itself. `append` grows the slice, but only allocates a new backing array once the existing one runs out of capacity. Until then it writes in place.

```go
base := make([]int, 3, 5)  // len 3, cap 5
a := base[:2]               // len 2, cap 5 — same backing array
b := append(a, 99)          // fits within cap 5, no reallocation

fmt.Println(base) // [0 0 99] — base[2] changed, and we never touched base
fmt.Println(b)    // [0 0 99]
```

This is the sharpest surprise in the language for anyone coming from Python or JavaScript: two slices that look independent can share memory, and appending to one can silently overwrite data in the other. It happens whenever you slice a slice and then append to the result without knowing its capacity. The fix is `copy` — allocate a slice sized exactly for what you need and copy into it — whenever a sub-slice is going to outlive the thing it was sliced from.

::code-blank{lang="go" href="/tracks/go/structs-and-interfaces" label="practice structs and interfaces for real"}
---
code: |
  nums := []int{1, 2, 3}
  nums = ___blank_start___append___blank_end___(nums, 4)
---
::

## Maps and the comma-ok idiom

A map read on a missing key returns the zero value, silently — `scores["dave"]` is `0` whether or not `"dave"` is a key. To tell "zero" from "absent," use the two-value form.

```go
scores := map[string]int{"alice": 95}
val, ok := scores["dave"]
if !ok {
	fmt.Println("no entry for dave")
}
```

A nil map reads like an empty one but panics on write — assigning into a nil `map[string]int` is a runtime panic, not a silent no-op. Initialize with `make` or a composite literal before you write to it. `clear(m)` (Go 1.21+) empties a map in place without reallocating, which is the idiomatic way to reset one you plan to reuse.

::code-blank{lang="go" href="/tracks/go/structs-and-interfaces" label="practice structs and interfaces for real"}
---
code: |
  val, ___blank_start___ok___blank_end___ := scores["dave"]
  if !ok {
      fmt.Println("missing")
  }
---
::

## Functions that return more than one value

A Go function can return several values, and the convention almost everywhere is that the last one is an `error`.

```go
func divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, errors.New("division by zero")
	}
	return a / b, nil
}

result, err := divide(10, 3)
if err != nil {
	log.Fatal(err)
}
```

`for i := range 5` (Go 1.22+) ranges directly over an integer, counting `0` through `4` — a fixed number of iterations without a throwaway slice or a C-style loop header. Named return values, like `func swap(x, y string) (first, second string)`, let you write a bare `return`, which reads well for a five-line function and turns into a puzzle in a fifty-line one — reserve them for the former.

## Where this bites

**Appending to a sub-slice corrupts a sibling slice.** Two slices from the same backing array look independent but are not; appending to one can overwrite the other's data if there is spare capacity. Copy the data out with `copy` whenever a sub-slice needs to outlive the slice it came from.

**Writing to a nil map panics; reading from one does not.** A declared-but-unassigned map is nil and safe to read — every lookup just returns the zero value. The first write panics with "assignment to entry in nil map." Initialize with `make` before anything gets assigned.

**`:=` inside an `if` or `for` shadows, it does not reuse.** `if val, err := f(); err != nil` declares a new `err` scoped to that block. Code after the block that checks an outer `err` variable of the same name is checking one that was never touched, and the failure passes through silently.

**Slices, maps, and functions cannot be compared with `==`.** They can only be compared to `nil`. Go catches the mistake at compile time — `invalid operation: a == b (slice can only be compared to nil)` — which is a kinder failure than a language that allows the comparison and gets it wrong at runtime, but it still surprises people who expect struct-style equality to apply everywhere.
