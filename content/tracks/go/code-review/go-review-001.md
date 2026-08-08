---
slug: go-review-001
title: 'Review: a truncate that corrupts text'
description: The truncation helper below was generated with tests, and the tests pass. Feed it anything that is not ASCII and it emits garbage. Find out why.
difficulty: intermediate
type: review
hints:
  - Every string in its test suite is plain ASCII. What is a Go string an index into?
  - Try the function by hand on "café" with a limit of 3 and look at the bytes you get back.
  - len() and s[:n] talk about bytes. The spec talks about characters.
tags:
  - code-review
  - strings
  - unicode
---

You asked a model for a helper that shortens a string to a maximum number of
characters, adding an ellipsis when it cuts. It produced this, with tests. The
tests pass.

It is still wrong: give it text containing any non-ASCII character — an
accent, a CJK ideograph, an emoji — and it can slice a character in half,
returning bytes that are not valid UTF-8. Downstream that renders as `�`, or
breaks a JSON encoder, depending on who touches it first. Nothing panics, so
nobody notices until the text is user-facing.

Find the defect and fix it. You are graded on tests you cannot see.

```go
package main

// Truncate shortens s to at most max characters. When it truncates, the
// result ends with "…" and the ellipsis counts toward the limit.
func Truncate(s string, max int) string {
	if max <= 0 {
		return ""
	}
	if len(s) <= max {
		return s
	}
	return s[:max-1] + "…"
}
```

## The tests it came with

These all pass. Every string in them is ASCII, which is exactly why they prove
less than they appear to.

```go
package main

import "testing"

func TestShortStringUntouched(t *testing.T) {
	if got := Truncate("hello", 10); got != "hello" {
		t.Fatalf("got %q", got)
	}
}

func TestLongStringTruncated(t *testing.T) {
	if got := Truncate("hello world", 8); got != "hello w…" {
		t.Fatalf("got %q", got)
	}
}

func TestZeroMax(t *testing.T) {
	if got := Truncate("hello", 0); got != "" {
		t.Fatalf("got %q", got)
	}
}
```

## Tests

```go
package main

import (
	"testing"
	"unicode/utf8"
)

func TestShortStringUntouched(t *testing.T) {
	if got := Truncate("hello", 10); got != "hello" {
		t.Fatalf("got %q", got)
	}
}

func TestLongStringTruncated(t *testing.T) {
	if got := Truncate("hello world", 8); got != "hello w…" {
		t.Fatalf("got %q", got)
	}
}

func TestZeroMax(t *testing.T) {
	if got := Truncate("hello", 0); got != "" {
		t.Fatalf("got %q", got)
	}
}

func TestExactLengthUntouched(t *testing.T) {
	if got := Truncate("hello", 5); got != "hello" {
		t.Fatalf("a string at the limit needs no ellipsis, got %q", got)
	}
}

func TestAccentedTextStaysValid(t *testing.T) {
	got := Truncate("café au lait", 5)
	if !utf8.ValidString(got) {
		t.Fatalf("result is not valid UTF-8: %q", got)
	}
	if got != "café…" {
		t.Fatalf("got %q", got)
	}
}

func TestMultibyteTextCountsCharacters(t *testing.T) {
	// Each ideograph is three bytes; the byte length is far past any limit
	// the character count respects.
	got := Truncate("日本語のテキスト", 4)
	if !utf8.ValidString(got) {
		t.Fatalf("result is not valid UTF-8: %q", got)
	}
	if got != "日本語…" {
		t.Fatalf("got %q", got)
	}
}

func TestMultibyteShortEnough(t *testing.T) {
	if got := Truncate("日本語", 3); got != "日本語" {
		t.Fatalf("three characters fit a limit of three, got %q", got)
	}
}
```

## Solution

```go
package main

// Truncate shortens s to at most max characters. When it truncates, the
// result ends with "…" and the ellipsis counts toward the limit.
func Truncate(s string, max int) string {
	if max <= 0 {
		return ""
	}

	// The original indexed the string directly: s[:max-1]. A Go string is a
	// byte slice, so that arithmetic counts bytes — "café" is five bytes, and
	// slicing at three lands mid-'é', producing bytes that are not valid
	// UTF-8. Every test it shipped with was ASCII, where bytes and characters
	// coincide, so its own suite could never see the difference.
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max-1]) + "…"
}
```
