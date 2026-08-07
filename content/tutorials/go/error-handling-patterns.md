---
title: "Error Handling Patterns"
slug: "go-error-handling-patterns"
description: "The working mechanics of Go error handling: the error interface, wrapping with %w, matching with errors.Is and errors.As, sentinel and custom error types, and where panic/recover actually belongs."
track: "go"
order: 4
difficulty: "intermediate"
tags: ["errors", "error-handling", "patterns", "wrapping", "sentinel-errors"]
practice:
  concept: "error-handling"
  label: "Error handling"
---

Go has no exceptions. A function that can fail returns an `error` alongside its result, and the caller checks it — every time, explicitly, right there at the call site. This tutorial is the mechanics: how to make an error, wrap it, match it, and combine several of them, without reaching for panic.

## The error interface, and how you make one

`error` is a one-method interface built into the language:

```go
type error interface {
	Error() string
}
```

Anything with an `Error() string` method satisfies it. For a one-off failure, `errors.New` and `fmt.Errorf` build one without a named type:

```go
func divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, errors.New("division by zero")
	}
	return a / b, nil
}

result, err := divide(10, 0)
if err != nil {
	fmt.Println(err)
	return
}
```

`if err != nil` right after the call is not boilerplate to tolerate — it is the whole design. Every call site shows you exactly where a failure is handled, because there is no separate control-flow path for it to travel through invisibly.

::code-blank{lang="go" href="/tracks/go/error-handling" label="practice error handling for real"}
---
code: |
  func divide(a, b float64) (float64, ___blank_start___error___blank_end___) {
      if b == 0 {
          return 0, errors.New("division by zero")
      }
      return a / b, nil
  }
---
::

## Wrapping with %w, and what it promises

An error passing through several layers usually needs context added at each one. `fmt.Errorf` with `%w` adds a message while keeping the original error reachable underneath.

```go
func readConfig(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}
	return data, nil
}
```

Use `%v` instead of `%w` when you want the text but not the promise — `%v` folds the error into a string with no way for a caller to reach the original through `errors.Is` or `errors.As` afterward. `%w` is a public commitment that the wrapped error stays inspectable; treat the choice as part of your function's contract, not a formatting detail.

## errors.Is and errors.As: matching without ==

`errors.Is(err, target)` checks whether `target` appears anywhere in the wrap chain. `errors.As(err, &target)` does the same search but for a type, and assigns the match into `target` if it finds one.

```go
_, err := os.Open("/nonexistent")

if errors.Is(err, os.ErrNotExist) {
	fmt.Println("file does not exist")
}

var pathErr *fs.PathError
if errors.As(err, &pathErr) {
	fmt.Println("failed op:", pathErr.Op)
}
```

Direct comparison, `err == os.ErrNotExist`, only works if nothing between you and the source wrapped the error — which you rarely control and should never assume. `errors.Is` and `errors.As` walk the whole chain, so they are correct in the cases `==` happens to work and correct in the ones it silently doesn't.

::code-blank{lang="go" href="/tracks/go/error-handling" label="practice error handling for real"}
---
code: |
  if errors.___blank_start___Is___blank_end___(err, os.ErrNotExist) {
      fmt.Println("missing")
  }
---
::

## Sentinel errors and custom error types

A sentinel error is a package-level value standing for one well-known condition — callers check for it with `errors.Is`.

```go
var ErrNotFound = errors.New("not found")

func (s *UserStore) Get(id int) (string, error) {
	name, ok := s.users[id]
	if !ok {
		return "", fmt.Errorf("get user %d: %w", id, ErrNotFound)
	}
	return name, nil
}
```

When a caller needs more than "which kind of failure" — a field name, a status code, a retry hint — define a type instead:

```go
type ValidationError struct {
	Field, Reason string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Reason)
}
```

Match it with `errors.As`, not a type assertion — the assertion only checks the outermost error, and this one is usually wrapped by the time it reaches whoever's checking.

::code-blank{lang="go" href="/tracks/go/error-handling" label="practice error handling for real"}
---
code: |
  func (e *ValidationError) ___blank_start___Error___blank_end___() string {
      return fmt.Sprintf("validation failed on %s", e.Field)
  }
---
::

## errors.Join: combining independent failures (Go 1.20+)

Validating several fields, or closing several resources, produces more than one error at once. `errors.Join` merges them into one value that still supports `Is` and `As` against every error inside it.

```go
func validate(name string, age int) error {
	var errs []error
	if name == "" {
		errs = append(errs, errors.New("name is required"))
	}
	if age < 0 {
		errs = append(errs, errors.New("age must not be negative"))
	}
	return errors.Join(errs...)
}
```

`errors.Join` returns `nil` when every argument is nil, so the all-fields-valid case needs no special handling. Here is the detail that surprises people: `fmt.Errorf` has also allowed more than one `%w` verb since Go 1.20 — `fmt.Errorf("%w: %w", errA, errB)` wraps both. A wrapped error is therefore not always a single chain; it can branch into a tree, since anything it wraps can itself wrap several more. `errors.Is` and `errors.As` handle this by calling `Unwrap() error` where there is one child and `Unwrap() []error` where there are several, searching the whole tree depth-first. Code that assumes "the cause" is one value at the bottom of one chain will miss a cause attached through the other branch.

## defer, panic, and recover — for the boundary, not the common path

`panic` is for a precondition your own code violated — not for a request a user sent you. `recover` almost always shows up at a boundary, wrapped in a `defer`, converting a panic into a normal error return instead of taking the process down.

```go
func safe(work func()) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("recovered: %v", r)
		}
	}()
	work()
	return nil
}
```

This is the shape it takes almost everywhere: HTTP middleware, a worker pool's per-job wrapper, anything running code you do not fully trust. Everywhere else, return an error instead — panic is not a faster `return err`, it is a different, harder-to-follow control path that every caller has to know exists.

## Where this bites

**Comparing errors with `==` instead of `errors.Is`.** It works right up until something upstream wraps the error once, and then it silently stops matching. Default to `errors.Is` and `errors.As`; reach for `==` only when you built the error yourself, inline, with nothing in between.

**Passing the wrong shape to `errors.As`.** The second argument must be a pointer to the target — `errors.As(err, &ve)`, not `errors.As(err, ve)`. Get the shape wrong and it panics rather than returning `false`, on purpose, because it is a programming mistake rather than a runtime condition worth tolerating.

**Discarding an error with `_` and no comment.** A silently ignored error looks identical to a deliberately ignored one in a diff. Leave a one-line comment saying why it is safe to drop, every time, so the next reader isn't left guessing.

**Treating recover as a substitute for returning errors.** It hides the failure path from every caller, who now cannot tell from the signature that the function might abort instead of returning. It also only catches panics in the same goroutine — a panic inside a goroutine you started crashes the process regardless of a `recover` anywhere else in the call stack.
