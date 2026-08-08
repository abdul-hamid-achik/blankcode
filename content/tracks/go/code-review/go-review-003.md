---
slug: go-review-003
title: 'Review: an error the caller can no longer recognize'
description: The lookup helper below wraps its errors and passes its tests. The caller checking errors.Is gets false every time. One formatting verb broke the chain.
difficulty: advanced
type: review
hints:
  - The spec promises errors.Is(err, ErrNotFound) works on what comes back. Find where the sentinel passes through fmt.Errorf.
  - '%v formats an error. %w does something more. The difference is invisible in the message and decisive in the type.'
  - The shipped tests read err.Error() and match text. Matching text is exactly what errors.Is exists to replace.
tags:
  - code-review
  - errors
  - wrapping
---

You asked a model for a config lookup with a proper error contract:

> `Lookup(store, key)` returns the value, or an error. When the key is
> missing, the returned error matches `errors.Is(err, ErrNotFound)`, so
> callers can branch on it without parsing strings. Errors carry the key in
> their message for logs.

It produced this, with tests. The tests pass — the messages read exactly
right.

`errors.Is` returns false on every error it produces. `fmt.Errorf` with `%v`
formats the sentinel *into the text* and drops it from the error chain; `%w`
is the verb that keeps the chain intact, and it is one character away. The
shipped suite asserts on `err.Error()` substrings — the string is identical
either way, which is why text-matching tests are structurally unable to
catch this. Every caller who wrote the `errors.Is` branch the spec promised
falls through to the generic path.

Find the defect and fix it. You are graded on tests you cannot see.

```go
package main

import (
	"errors"
	"fmt"
)

// ErrNotFound is the sentinel callers branch on with errors.Is.
var ErrNotFound = errors.New("not found")

// Lookup returns the value for key. A missing key yields an error that
// matches errors.Is(err, ErrNotFound) and names the key in its message.
func Lookup(store map[string]string, key string) (string, error) {
	value, ok := store[key]
	if !ok {
		return "", fmt.Errorf("lookup %q: %v", key, ErrNotFound)
	}
	return value, nil
}
```

## The tests it came with

These all pass. Every error assertion is a string match — the one kind of
check this bug survives.

```go
package main

import (
	"strings"
	"testing"
)

func TestFindsAValue(t *testing.T) {
	store := map[string]string{"region": "mx"}
	value, err := Lookup(store, "region")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value != "mx" {
		t.Fatalf("got %q", value)
	}
}

func TestMissingKeyMentionsTheKey(t *testing.T) {
	_, err := Lookup(map[string]string{}, "zone")
	if err == nil {
		t.Fatal("expected an error")
	}
	if !strings.Contains(err.Error(), "zone") {
		t.Fatalf("message should name the key: %v", err)
	}
}

func TestMissingKeyMentionsNotFound(t *testing.T) {
	_, err := Lookup(map[string]string{}, "zone")
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("message should say not found: %v", err)
	}
}
```

## Tests

```go
package main

import (
	"errors"
	"strings"
	"testing"
)

func TestFindsAValue(t *testing.T) {
	store := map[string]string{"region": "mx"}
	value, err := Lookup(store, "region")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value != "mx" {
		t.Fatalf("got %q", value)
	}
}

func TestMissingKeyMentionsTheKey(t *testing.T) {
	_, err := Lookup(map[string]string{}, "zone")
	if err == nil {
		t.Fatal("expected an error")
	}
	if !strings.Contains(err.Error(), "zone") {
		t.Fatalf("message should name the key: %v", err)
	}
}

func TestMissingKeyMentionsNotFound(t *testing.T) {
	_, err := Lookup(map[string]string{}, "zone")
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("message should say not found: %v", err)
	}
}

func TestSentinelSurvivesWrapping(t *testing.T) {
	// The contract the spec actually promised: no string parsing required.
	_, err := Lookup(map[string]string{}, "zone")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("errors.Is must recognize the sentinel through the wrap, got: %v", err)
	}
}

func TestPresentKeyHasNoError(t *testing.T) {
	store := map[string]string{"empty": ""}
	// An empty string is a present value, not a missing key.
	value, err := Lookup(store, "empty")
	if err != nil {
		t.Fatalf("empty value is still a value: %v", err)
	}
	if value != "" {
		t.Fatalf("got %q", value)
	}
}
```

## Solution

```go
package main

import (
	"errors"
	"fmt"
)

// ErrNotFound is the sentinel callers branch on with errors.Is.
var ErrNotFound = errors.New("not found")

// Lookup returns the value for key. A missing key yields an error that
// matches errors.Is(err, ErrNotFound) and names the key in its message.
func Lookup(store map[string]string, key string) (string, error) {
	value, ok := store[key]
	if !ok {
		// The original used %v, which FORMATS the sentinel into the text and
		// drops it from the error chain — the message reads identically, and
		// errors.Is returns false forever. %w is the wrapping verb: same
		// string, chain intact. One character is the whole contract.
		return "", fmt.Errorf("lookup %q: %w", key, ErrNotFound)
	}
	return value, nil
}
```
