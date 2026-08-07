---
title: "Errors Are Values: The Patterns That Follow"
slug: "go-errors-are-values"
description: "Treat the errors you return as part of your package's API — choosing between sentinel and typed errors, wrapping deliberately, and matching with errors.Is and errors.As."
track: "go"
order: 5
difficulty: "advanced"
tags: ["errors", "api-design", "wrapping", "errors-is", "errors-as", "sentinel-errors"]
practice:
  concept: "error-handling"
  label: "Error handling"
---

"Errors are values" is usually read as a statement about syntax: Go returns them instead of throwing them. The more useful reading is about API design. If an error is a value your function returns, the errors you return are part of your signature. Once a caller writes `errors.Is(err, ErrNotFound)`, you cannot change that error without breaking their code — exactly as if you had changed a parameter's type. Most of what follows falls out of taking that seriously.

## What the caller can do decides the shape

Before designing an error, ask what a caller could actually do with it. There are three answers, and each maps to a different construct.

Nothing but report it — the large majority of cases. Return a wrapped error and move on. Branch on which kind it is — the caller needs to tell "not found" from "everything else." That's a **sentinel error**. Extract data from it — a field name, a status code, a retry duration. That's a **typed error**.

Design an error any other way — a typed error nobody inspects, a sentinel for something that needs to carry data — and you've built API surface you have to keep stable that nobody actually uses.

## Wrapping: what to add, what to keep private

`%w` in `fmt.Errorf` adds context while keeping the original reachable:

```go
func (s *Store) LoadUser(ctx context.Context, id string) (*User, error) {
	var u User
	err := s.db.QueryRowContext(ctx, userQuery, id).Scan(&u.ID, &u.Name)
	if err != nil {
		return nil, fmt.Errorf("load user %s: %w", id, err)
	}
	return &u, nil
}
```

Add what the caller doesn't already have — the database layer knows the query failed, not that it was doing it for user `u_1839`. Each layer adds one fact, and the final message reads as a path: `handle GET /users/u_1839: load user u_1839: query row: connection refused`. Two conventions keep that readable: lower-case the start, no trailing punctuation, and skip "failed to" — every string in the chain is already a failure, so the phrase adds length without information.

`%w` is also a publication decision. Anything a caller can reach with `errors.Is` or `errors.As` is a promise, whether you meant to make it or not:

```go
// Makes sql.ErrNoRows part of your API. Callers will match on it, and you can
// never switch database drivers without breaking them.
return fmt.Errorf("load user: %w", err)

// Does not. The text survives; the type does not escape.
return fmt.Errorf("load user: %v", err)
```

At a package boundary, translate rather than pass through — catch the implementation's error, return your own:

```go
var ErrUserNotFound = errors.New("user not found")

if errors.Is(err, sql.ErrNoRows) {
	return nil, fmt.Errorf("load user %s: %w", id, ErrUserNotFound)
}
```

Callers now match on `ErrUserNotFound`, which is yours to keep stable, and the storage layer stays swappable underneath it.

## Sentinel errors as API surface

A sentinel is a package-level value identifying one condition.

```go
package store

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
)
```

Match with `errors.Is`, which walks the chain instead of comparing directly:

```go
switch {
case errors.Is(err, store.ErrNotFound):
	http.Error(w, "no such user", http.StatusNotFound)
case err != nil:
	http.Error(w, "internal error", http.StatusInternalServerError)
}
```

`err == store.ErrNotFound` fails the moment anything wraps the error on the way up, which is most of the time. Keep the set small — every sentinel is a permanent part of your API, and a package with fifteen of them is exposing implementation detail that callers will start depending on whether you intended it or not.

::code-blank{lang="go" href="/tracks/go/error-handling" label="practice error handling for real"}
---
code: |
  ___blank_start___var___blank_end___ ErrNotFound = errors.New("not found")
---
::

## Typed errors and the Unwrap contract

When the caller needs data, define a type instead:

```go
type ValidationError struct {
	Field, Reason string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("field %s: %s", e.Field, e.Reason)
}
```

Extract with `errors.As`, which walks the chain and assigns into a target:

```go
var ve *ValidationError
if errors.As(err, &ve) {
	respondBadRequest(w, ve.Field, ve.Reason)
}
```

The target is a pointer to the error type. `Error()` is defined on `*ValidationError`, so the value sitting in the chain is a `*ValidationError`, which makes the target a `**ValidationError` — exactly what `&ve` is when `ve` is declared `var ve *ValidationError`. Pass anything else and `errors.As` panics rather than returning `false`, deliberately, because that shape mismatch is a programming mistake, not a runtime condition.

A typed error that wraps another error has to expose it, or the chain stops there:

```go
type QueryError struct {
	Query string
	Err   error
}

func (e *QueryError) Error() string { return fmt.Sprintf("query %s: %v", e.Query, e.Err) }
func (e *QueryError) Unwrap() error { return e.Err }
```

Without `Unwrap`, `errors.Is(err, sql.ErrNoRows)` returns false even though the information is sitting right there in the struct — `Unwrap` is what `errors.Is` and `errors.As` actually walk.

::code-blank{lang="go" href="/tracks/go/error-handling" label="practice error handling for real"}
---
code: |
  func (e *QueryError) ___blank_start___Unwrap___blank_end___() error {
      return e.Err
  }
---
::

## Matching on behavior instead of type

The most decoupled option skips both sentinels and types and matches on what an error can *do*:

```go
type temporary interface {
	Temporary() bool
}

func isTemporary(err error) bool {
	var t temporary
	return errors.As(err, &t) && t.Temporary()
}
```

`errors.As` accepts a pointer to an interface, not just a concrete type, so this asks "does anything in the chain implement this method" instead of "is anything in the chain this exact type." It's how a retry loop can work across packages that have never imported each other — the interface is defined by the consumer, which is the usual Go move, and no dependency is created in either direction.

The same escape hatch exists for identity itself. An error can implement its own `Is(target error) bool`, which `errors.Is` calls on every error in the chain instead of falling back to `==`:

```go
func (e *HTTPError) Is(target error) bool {
	other, ok := target.(*HTTPError)
	return ok && other.Code == e.Code
}
```

Use it sparingly. An `Is` method that redefines what "equal" means is something every future reader has to discover before `errors.Is` behaves the way they expect from it.

## Collecting errors, and not logging what you're about to return

`errors.Join` (Go 1.20+) builds one error out of many, and `errors.Is`/`errors.As` search all of them:

```go
func Validate(u User) error {
	var errs []error
	if u.Name == "" {
		errs = append(errs, &ValidationError{Field: "name", Reason: "required"})
	}
	if u.Age < 0 {
		errs = append(errs, &ValidationError{Field: "age", Reason: "must not be negative"})
	}
	return errors.Join(errs...)
}
```

`errors.Join` returns `nil` when every argument is nil, so the all-valid case needs no extra branch. This is the right shape for validation, where reporting every problem at once beats a user fixing one field per round trip.

::code-blank{lang="go" href="/tracks/go/error-handling" label="practice error handling for real"}
---
code: |
  return errors.___blank_start___Join___blank_end___(errs...)
---
::

One habit undoes a lot of the design above: logging an error and then also returning it.

```go
if err != nil {
	log.Printf("load user: %v", err) // logged here
	return err                        // and logged again by the caller
}
```

Every layer that does this multiplies the output into the same failure repeated five times with slightly different wording. Pick one: handle the error here, which includes logging it and not returning it, or add context and return it. Whichever layer decides what happens is the layer that logs.

## Where this bites

**Returning a typed nil as your `error` result breaks the contract you just designed.** `var err *MyError; return err` produces a non-nil `error` interface even when `err` is nil, and every caller doing `if err != nil` gets the wrong answer. Return `nil` literally whenever the declared return type is the `error` interface, never a concrete-typed local that happens to be nil.

**Wrapping an error you don't own publishes its type as part of your API.** `fmt.Errorf("load user: %w", err)` around `sql.ErrNoRows` means callers can now write `errors.Is(err, sql.ErrNoRows)` against your function, whether you meant to promise that or not. Translate at the boundary into a sentinel you control instead of forwarding someone else's.

**Sentinel-error sprawl turns implementation detail into a permanent commitment.** A package with fifteen exported `ErrX` values, most never checked by a real caller, has to keep all fifteen stable forever. Add one only when you can point to the `errors.Is` call site that needs it.

**Testing against `err.Error()` text instead of `errors.Is` or `errors.As`.** Message text is prose, and prose changes; a wrapper added anywhere in the chain breaks a string-equality test that never should have depended on wording. Assert on the thing the caller actually branches on — the sentinel, or the type — and let the message be free to improve.
