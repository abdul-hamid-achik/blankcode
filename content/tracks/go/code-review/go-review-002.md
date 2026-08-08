---
slug: go-review-002
title: 'Review: a dedupe that rearranges its caller'
description: The dedupe helper below passes its tests and returns exactly the right elements. It also quietly sorts the slice you handed it. Find both problems.
difficulty: intermediate
type: review
hints:
  - The spec makes two promises. Count how many of them the shipped tests actually check.
  - Call it, then look at the slice you passed in — not the one you got back.
  - Sorting makes duplicates adjacent, which is convenient for the implementation and wrong for everyone else.
tags:
  - code-review
  - slices
  - mutation
---

You asked a model to remove duplicates from a slice of strings. The spec was
two sentences:

> Return a new slice with duplicates removed, keeping the first occurrence of
> each value in its original position. The input slice is not modified.

It produced this, with tests. The tests pass, and the returned elements are
always exactly right.

Both promises are still broken. The function sorts — which reorders the output
*and* writes through to the caller's slice, because `sort.Strings` works in
place on the memory you handed over. A caller who lent you their data gets it
back shuffled. The shipped suite never looks at the input afterwards and only
ever asserts membership, so it proves neither promise.

Find the defect and fix it. You are graded on tests you cannot see.

```go
package main

import "sort"

// Dedupe returns a new slice with duplicates removed, keeping the first
// occurrence of each value in its original position. The input slice is not
// modified.
func Dedupe(values []string) []string {
	sort.Strings(values)

	result := make([]string, 0, len(values))
	for i, v := range values {
		if i == 0 || values[i-1] != v {
			result = append(result, v)
		}
	}
	return result
}
```

## The tests it came with

These all pass. Notice what they assert — and what they never look at again.

```go
package main

import "testing"

func TestRemovesDuplicates(t *testing.T) {
	got := Dedupe([]string{"a", "b", "a", "c", "b"})
	if len(got) != 3 {
		t.Fatalf("expected 3 values, got %v", got)
	}
}

func TestAlreadyUnique(t *testing.T) {
	got := Dedupe([]string{"a", "b", "c"})
	if len(got) != 3 {
		t.Fatalf("expected 3 values, got %v", got)
	}
}

func TestEmpty(t *testing.T) {
	if got := Dedupe(nil); len(got) != 0 {
		t.Fatalf("expected empty, got %v", got)
	}
}
```

## Tests

```go
package main

import (
	"reflect"
	"testing"
)

func TestRemovesDuplicates(t *testing.T) {
	got := Dedupe([]string{"a", "b", "a", "c", "b"})
	if len(got) != 3 {
		t.Fatalf("expected 3 values, got %v", got)
	}
}

func TestAlreadyUnique(t *testing.T) {
	got := Dedupe([]string{"a", "b", "c"})
	if len(got) != 3 {
		t.Fatalf("expected 3 values, got %v", got)
	}
}

func TestEmpty(t *testing.T) {
	if got := Dedupe(nil); len(got) != 0 {
		t.Fatalf("expected empty, got %v", got)
	}
}

func TestKeepsFirstOccurrenceOrder(t *testing.T) {
	got := Dedupe([]string{"orange", "apple", "orange", "pear"})
	want := []string{"orange", "apple", "pear"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("order must follow first occurrence: want %v, got %v", want, got)
	}
}

func TestDoesNotModifyInput(t *testing.T) {
	input := []string{"c", "a", "b", "a"}
	Dedupe(input)
	want := []string{"c", "a", "b", "a"}
	if !reflect.DeepEqual(input, want) {
		t.Fatalf("the caller's slice was modified: %v", input)
	}
}

func TestSingleValue(t *testing.T) {
	got := Dedupe([]string{"only"})
	if !reflect.DeepEqual(got, []string{"only"}) {
		t.Fatalf("got %v", got)
	}
}
```

## Solution

```go
package main

// Dedupe returns a new slice with duplicates removed, keeping the first
// occurrence of each value in its original position. The input slice is not
// modified.
func Dedupe(values []string) []string {
	// The original sorted first, because adjacent duplicates are easy to
	// skip. But sort.Strings works in place: it reordered the result AND the
	// caller's own slice — a slice is a view over shared memory, not a copy.
	// A set does the same job without touching the input.
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))

	for _, v := range values {
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		result = append(result, v)
	}
	return result
}
```
