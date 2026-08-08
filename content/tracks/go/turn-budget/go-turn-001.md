---
slug: go-turn-001
title: 'Three messages: a URL joiner with one slash exactly'
description: Get a model to write JoinURL in three messages. The hidden suite feeds it every slash arrangement people actually produce — and the two inputs nobody mentions.
difficulty: intermediate
type: turn
turnBudget: 3
hints:
  - There are four arrangements of trailing and leading slash. Say what happens in all four, or the model will pick per case and tell you about none.
  - An empty path is not a joining problem. Decide what it means before the model decides for you.
  - Check the returned code against "api/" + "/v1/" by hand before spending another message.
tags:
  - ai
  - prompting
  - strings
---

Write `JoinURL`, using a model, in **three messages**.

> `JoinURL(base, path)` joins two URL fragments with exactly one `/` between
> them, whatever each side arrived with. Trailing slashes on the result are
> preserved from `path`. An empty `path` returns `base` unchanged. An empty
> `base` is an error.

That is the whole specification. Its surface is tiny and its input space is
not: base and path each may or may not carry a slash at the seam, which is
four arrangements before anyone mentions the empty strings. A model will
handle the two arrangements you name in your first message and improvise the
rest — and string improvisation is where `//v1` and `apiv1` come from.

**The suite you are graded against is hidden until you submit.** You cannot
paste it to the model; if you could, the skill being practised would be
pasting.

You have three messages and you do not have to use them. Submitting with a
turn in hand is a better result, and the report says which happened.

```go
package main

import "errors"

var _ = errors.New

// JoinURL joins base and path with exactly one slash between them.
//
// Write this with the model. When you are satisfied, submit — the hidden
// suite runs against whatever is in here.
func JoinURL(base, path string) (string, error) {
	return "", errors.New("not implemented")
}
```

## Tests

```go
package main

import "testing"

func join(t *testing.T, base, path string) string {
	t.Helper()
	got, err := JoinURL(base, path)
	if err != nil {
		t.Fatalf("JoinURL(%q, %q): unexpected error %v", base, path, err)
	}
	return got
}

func TestNeitherSideHasSlash(t *testing.T) {
	if got := join(t, "https://api.example.com", "v1"); got != "https://api.example.com/v1" {
		t.Fatalf("got %q", got)
	}
}

func TestBaseHasSlash(t *testing.T) {
	if got := join(t, "https://api.example.com/", "v1"); got != "https://api.example.com/v1" {
		t.Fatalf("got %q", got)
	}
}

func TestPathHasSlash(t *testing.T) {
	if got := join(t, "https://api.example.com", "/v1"); got != "https://api.example.com/v1" {
		t.Fatalf("got %q", got)
	}
}

func TestBothHaveSlashes(t *testing.T) {
	// The arrangement that produces "//v1" in improvised joiners.
	if got := join(t, "https://api.example.com/", "/v1"); got != "https://api.example.com/v1" {
		t.Fatalf("got %q", got)
	}
}

func TestDeeperPathKeepsInnerSlashes(t *testing.T) {
	if got := join(t, "https://api.example.com", "v1/orders/42"); got != "https://api.example.com/v1/orders/42" {
		t.Fatalf("got %q", got)
	}
}

func TestTrailingSlashOnPathSurvives(t *testing.T) {
	// Only the SEAM is normalized. A trailing slash on path is meaningful
	// to plenty of servers and is not this function's business.
	if got := join(t, "https://api.example.com", "v1/"); got != "https://api.example.com/v1/" {
		t.Fatalf("got %q", got)
	}
}

func TestEmptyPathReturnsBaseUnchanged(t *testing.T) {
	// Unchanged means unchanged: no slash appended, nothing normalized.
	if got := join(t, "https://api.example.com/", ""); got != "https://api.example.com/" {
		t.Fatalf("got %q", got)
	}
}

func TestEmptyBaseIsAnError(t *testing.T) {
	_, err := JoinURL("", "v1")
	if err == nil {
		t.Fatal("an empty base has nothing to join onto; expected an error")
	}
}
```

## Solution

```go
package main

import (
	"errors"
	"strings"
)

// JoinURL joins base and path with exactly one slash between them.
func JoinURL(base, path string) (string, error) {
	/*
	 * The clauses that decide this exercise are the ones a first message
	 * skips:
	 *
	 * - all FOUR slash arrangements at the seam normalize to one slash —
	 *   trimming both sides and re-adding exactly one covers the whole grid,
	 *   where per-case improvisation produces "//v1" or "apiv1";
	 * - an empty path returns base UNCHANGED — appending a helpful slash
	 *   there changes URLs that were already correct;
	 * - an empty base errors, because "/v1" is not a joined URL, it is a
	 *   different bug moved downstream.
	 */
	if base == "" {
		return "", errors.New("JoinURL: empty base")
	}
	if path == "" {
		return base, nil
	}
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/"), nil
}
```
