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

# Errors Are Values: The Patterns That Follow

"Errors are values" is usually presented as a statement about syntax: Go returns
them instead of throwing them. The more useful reading is about API design.

If an error is a value your function returns, then **the errors you return are
part of your signature**. Callers will branch on them. Once someone writes
`if errors.Is(err, ErrNotFound)`, you cannot change that error without breaking
their code, exactly as if you had changed a parameter type. Most of the patterns
below fall out of taking that seriously.

## Start from what the caller can do

Before designing an error, ask what a caller could possibly do with it. There
are only three answers, and each maps to a different construct.

**Nothing but report it.** The vast majority. Return a plain error with context
and move on.

```go
if err != nil {
    return fmt.Errorf("read config %s: %w", path, err)
}
```

**Branch on which kind it is.** The caller needs to distinguish "not found" from
"everything else". This is a **sentinel error**.

**Extract information from it.** The caller needs the field name that failed
validation, the HTTP status, the retry-after duration. This is a **typed error**.

Designing errors any other way — a typed error for something nobody inspects, a
sentinel for something that needs to carry data — produces API surface you have
to keep and nobody uses.

## Wrapping: what to add, and what not to

`%w` in `fmt.Errorf` wraps: the new error carries a message and keeps the
original reachable.

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

Add the context the caller does not have. The database layer knows the SQL
failed; it does not know it was doing this for user `u_1839`. Each layer adds
its own fact, and the final message reads as a path:

```
handle GET /users/u_1839: load user u_1839: query row: connection refused
```

Two conventions make that message readable. Error strings start lower case and
do not end in punctuation, because they get embedded in other messages. And they
do not begin with "failed to" — every string in that chain is a failure, so the
words add length and no information.

### When not to wrap

`%w` publishes the wrapped error. Anything a caller can reach with `errors.Is`
or `errors.As` is a promise you have made, whether you meant to or not.

```go
// This makes sql.ErrNoRows part of your package's API. Callers will match on
// it, and you can never switch to a different database driver.
return fmt.Errorf("load user: %w", err)

// This does not. The detail survives in the message; the type does not escape.
return fmt.Errorf("load user: %v", err)
```

At a package boundary, the useful default is to translate rather than to pass
through: catch the implementation's error, and return your own.

```go
var ErrUserNotFound = errors.New("user not found")

if errors.Is(err, sql.ErrNoRows) {
    return nil, fmt.Errorf("load user %s: %w", id, ErrUserNotFound)
}
```

Callers now match on `ErrUserNotFound`, which is yours to keep stable, and the
storage layer stays replaceable.

## Sentinel errors

A sentinel is a package-level value that identifies a condition.

```go
package store

var (
    ErrNotFound  = errors.New("not found")
    ErrConflict  = errors.New("conflict")
    ErrClosed    = errors.New("store is closed")
)
```

Match with `errors.Is`, which walks the wrap chain rather than comparing
directly:

```go
user, err := store.LoadUser(ctx, id)
switch {
case errors.Is(err, store.ErrNotFound):
    http.Error(w, "no such user", http.StatusNotFound)
    return
case err != nil:
    http.Error(w, "internal error", http.StatusInternalServerError)
    return
}
```

`err == store.ErrNotFound` would fail here, because the error has been wrapped
at least once on the way up. Comparing errors with `==` is only correct when you
know nothing between you and the source wrapped it, and you rarely know that.

Keep the set small. Every sentinel is a permanent part of your API, and a
package with fifteen of them is describing implementation details that callers
will start depending on.

## Typed errors

When the caller needs data, define a type.

```go
type ValidationError struct {
    Field  string
    Reason string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("field %s: %s", e.Field, e.Reason)
}
```

Extract with `errors.As`, which also walks the chain and assigns into a target:

```go
var ve *ValidationError
if errors.As(err, &ve) {
    respondBadRequest(w, ve.Field, ve.Reason)
    return
}
```

Two details cost people time here:

**The target is a pointer to the error type.** `Error()` is defined on
`*ValidationError`, so the error value is a `*ValidationError`, so the target is
`**ValidationError` — which is what `&ve` is when `ve` is declared as
`var ve *ValidationError`. Passing anything else panics rather than returning
false, deliberately, because it is a programming error rather than a runtime
condition.

**Implement `Error()` on the pointer receiver and stay consistent.** If some
methods take a value receiver and some take a pointer, callers cannot predict
whether to look for `ValidationError` or `*ValidationError`, and `errors.As`
will quietly fail to match the one they did not choose.

### Wrapping inside a typed error

A typed error that contains another error should expose it, or the chain stops
there:

```go
type QueryError struct {
    Query string
    Err   error
}

func (e *QueryError) Error() string {
    return fmt.Sprintf("query %s: %v", e.Query, e.Err)
}

func (e *QueryError) Unwrap() error {
    return e.Err
}
```

Without `Unwrap`, `errors.Is(err, sql.ErrNoRows)` returns false even though the
information is right there in the struct. `Unwrap` is what `errors.Is` and
`errors.As` walk.

## Custom matching with an `Is` method

Sometimes identity is not what you want to match on. An error carrying an HTTP
status should compare equal to any error with the same status:

```go
type HTTPError struct {
    Code int
}

func (e *HTTPError) Error() string {
    return fmt.Sprintf("http %d", e.Code)
}

func (e *HTTPError) Is(target error) bool {
    other, ok := target.(*HTTPError)
    return ok && other.Code == e.Code
}
```

```go
if errors.Is(err, &HTTPError{Code: http.StatusTooManyRequests}) {
    backOff()
}
```

`errors.Is` calls the `Is` method on each error in the chain, so this works
through wrapping. Use it sparingly — an `Is` method that is cleverer than
equality is a thing every future reader has to discover.

## Matching on behaviour instead of type

The most decoupled option is to match on what an error *can do*, not what it is.
`errors.As` accepts a pointer to an interface, so you can ask whether anything
in the chain implements a method.

```go
type temporary interface {
    Temporary() bool
}

func isTemporary(err error) bool {
    var t temporary
    return errors.As(err, &t) && t.Temporary()
}
```

This is how a retry loop can work across packages that have never heard of each
other. The interface is defined by the consumer, which is the usual Go move, and
no import relationship is created in either direction.

## Collecting several errors

`errors.Join` (Go 1.20+) builds one error from many, and `errors.Is` and
`errors.As` search all of them.

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

`errors.Join` returns `nil` when every argument is nil, so the empty case needs
no special handling. The joined error's message is each error on its own line.

This is the right shape for validation, where reporting the first problem and
stopping makes a user fix one field per round trip.

## Do not log and return

```go
if err != nil {
    log.Printf("load user: %v", err)   // logged here
    return err                          // and logged again by the caller
}
```

Every layer that does this multiplies the output, and the resulting log has the
same failure five times with slightly different wording. Pick one: either handle
the error here — which includes logging it and not returning it — or add context
and return it. The layer that decides what happens is the layer that logs.

## Test the identity, not the message

Error messages are prose and they change. What you actually care about is that
the right error came back.

```go
// Brittle — a wrapper anywhere in the chain breaks this
if err.Error() != "user not found" {
    t.Fatalf("unexpected error: %v", err)
}

// Stable — asserts the thing the caller will branch on
if !errors.Is(err, store.ErrUserNotFound) {
    t.Fatalf("got %v, want ErrUserNotFound", err)
}

var ve *ValidationError
if !errors.As(err, &ve) {
    t.Fatalf("got %v, want *ValidationError", err)
} else if ve.Field != "name" {
    t.Errorf("got field %q, want name", ve.Field)
}
```

A test that asserts on the message string is testing your wording. A test that
asserts on `errors.Is` is testing your API — and if the assertion is awkward to
write, the API is awkward to use, which is worth learning before your callers do.

## Practice

The mechanics behind all of this — the `error` interface, `fmt.Errorf`,
`errors.Is`, `errors.As`, `errors.Join`, and `defer`/`panic`/`recover` — are
covered in [Error Handling Patterns](/tutorials/go-error-handling-patterns).

Work through the error handling exercises on the [Go track](/tracks/go) to
practise the design decisions: which errors your package should expose, when to
wrap and when to translate, and how a caller is meant to tell one failure from
another.
