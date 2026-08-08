---
slug: go-spec-001
title: 'Pin it down: the cases that make card masking unambiguous'
description: Five implementations of MaskCard. One is right and four are subtly wrong, and every one of them handles the demo input perfectly. Write the cases that tell them apart.
difficulty: intermediate
type: challenge
hints:
  - Each wrong implementation ignores exactly one sentence. Read the description sentence by sentence and design one input per sentence.
  - A plain sixteen-digit string satisfies almost every implementation. The separators and the short inputs are where they disagree.
  - Your expected values must be right too — the correct implementation has to pass every case you write.
tags:
  - specification
  - testing
  - strings
---

Ask for "mask this card number" and you will get something that works on
`4242424242424242`. It will also do *something* with `4242 4242 4242 4242`,
and with the 4-digit test value support keeps in a fixture — and what it
does is a decision somebody made without telling you.

Here is the description, stated properly:

> `MaskCard(number)` masks a card number for display. Every digit except the
> last four becomes `*`. Characters that are not digits — spaces, dashes —
> are preserved in their positions. Masking counts digits, not characters.
> An input with four or fewer digits is returned unchanged.

Below are five implementations. One satisfies that description. Four satisfy
a reading of it that skips one sentence — and all five look fine on the
demo input.

**Your job is not to write `MaskCard`.** It is to write the cases that
accept the correct implementation and reject each of the other four.

```go
package main

// Case is one input pinned to the output the description requires.
type Case struct {
	Input    string
	Expected string
}

// Cases pins the description down.
//
// To pass, this list must accept the correct implementation and reject each
// of the four wrong ones. A case whose Expected is not what the description
// requires will fail against the correct implementation, so getting the
// values right is part of the exercise.
var Cases = []Case{
	// Your cases here
}
```

## Tests

```go
package main

import "testing"

type maskFunc func(string) string

// Satisfies every sentence of the description.
func correct(number string) string {
	digits := 0
	for _, r := range number {
		if r >= '0' && r <= '9' {
			digits++
		}
	}
	if digits <= 4 {
		return number
	}
	toMask := digits - 4
	out := []rune(number)
	for i, r := range out {
		if r >= '0' && r <= '9' && toMask > 0 {
			out[i] = '*'
			toMask--
		}
	}
	return string(out)
}

// Skips "characters that are not digits are preserved in their positions".
func stripsSeparators(number string) string {
	digits := []rune{}
	for _, r := range number {
		if r >= '0' && r <= '9' {
			digits = append(digits, r)
		}
	}
	if len(digits) <= 4 {
		return number
	}
	for i := 0; i < len(digits)-4; i++ {
		digits[i] = '*'
	}
	return string(digits)
}

// Skips "masking counts digits, not characters": masks all but the last
// four CHARACTERS, so separators shift what stays visible.
func countsCharacters(number string) string {
	out := []rune(number)
	if len(out) <= 4 {
		return number
	}
	for i := 0; i < len(out)-4; i++ {
		if out[i] >= '0' && out[i] <= '9' {
			out[i] = '*'
		}
	}
	return string(out)
}

// Skips "an input with four or fewer digits is returned unchanged".
func masksShortInputs(number string) string {
	out := []rune(number)
	masked := 0
	digits := 0
	for _, r := range out {
		if r >= '0' && r <= '9' {
			digits++
		}
	}
	for i, r := range out {
		if r >= '0' && r <= '9' && masked < digits-4 {
			out[i] = '*'
			masked++
		}
	}
	if digits <= 4 && digits > 0 {
		for i, r := range out {
			if r >= '0' && r <= '9' {
				out[i] = '*'
				_ = i
				break
			}
		}
	}
	return string(out)
}

// Skips "every digit except the last four": leaves the FIRST four visible
// instead — the mirror-image reading.
func masksTheWrongEnd(number string) string {
	out := []rune(number)
	digits := 0
	for _, r := range out {
		if r >= '0' && r <= '9' {
			digits++
		}
	}
	if digits <= 4 {
		return number
	}
	seen := 0
	for i, r := range out {
		if r >= '0' && r <= '9' {
			seen++
			if seen > 4 {
				out[i] = '*'
			}
		}
	}
	return string(out)
}

func survives(t *testing.T, mask maskFunc) bool {
	t.Helper()
	for _, c := range Cases {
		if mask(c.Input) != c.Expected {
			return false
		}
	}
	return true
}

func TestCasesExist(t *testing.T) {
	if len(Cases) == 0 {
		t.Fatal("write at least one case")
	}
}

func TestCasesAreCorrect(t *testing.T) {
	// Every expected value has to be what the description actually requires.
	// A case built around a guess would reject the right implementation.
	for _, c := range Cases {
		if got := correct(c.Input); got != c.Expected {
			t.Fatalf("case %q expects %q, but the description requires %q", c.Input, c.Expected, got)
		}
	}
}

func TestAcceptTheCorrectImplementation(t *testing.T) {
	if !survives(t, correct) {
		t.Fatal("the cases must accept the correct implementation")
	}
}

func TestRejectStrippingSeparators(t *testing.T) {
	if survives(t, stripsSeparators) {
		t.Fatal("an implementation that strips separators must fail at least one case")
	}
}

func TestRejectCountingCharacters(t *testing.T) {
	if survives(t, countsCharacters) {
		t.Fatal("an implementation that counts characters instead of digits must fail at least one case")
	}
}

func TestRejectMaskingShortInputs(t *testing.T) {
	if survives(t, masksShortInputs) {
		t.Fatal("an implementation that touches four-or-fewer-digit inputs must fail at least one case")
	}
}

func TestRejectMaskingTheWrongEnd(t *testing.T) {
	if survives(t, masksTheWrongEnd) {
		t.Fatal("an implementation that keeps the first four digits must fail at least one case")
	}
}

func TestNotByVolume(t *testing.T) {
	// Four wrong implementations need at most four inputs to expose. Fifty
	// near-identical cases are not a specification, they are noise.
	if len(Cases) > 12 {
		t.Fatalf("%d cases — a specification this small pins down in far fewer", len(Cases))
	}
}

func TestNoDuplicateInputs(t *testing.T) {
	seen := map[string]bool{}
	for _, c := range Cases {
		if seen[c.Input] {
			t.Fatalf("duplicate input %q", c.Input)
		}
		seen[c.Input] = true
	}
}
```

## Solution

```go
package main

// Case is one input pinned to the output the description requires.
type Case struct {
	Input    string
	Expected string
}

/*
 * Four wrong implementations, four sentences of the description, and each
 * case below is aimed at exactly one. The plain sixteen-digit input is
 * deliberately absent from the interesting set: every implementation gets
 * it right, and agreement on the easy input is what hides the disagreement
 * on the hard ones.
 */
var Cases = []Case{
	// The baseline, where all five agree — worth one case, not ten.
	{Input: "4242424242424242", Expected: "************4242"},

	// Separators must SURVIVE in position. The stripper returns
	// "************4242" here; the description requires the spaces intact.
	{Input: "4242 4242 4242 4242", Expected: "**** **** **** 4242"},

	// Counting characters vs digits. On evenly-grouped numbers the two
	// countings coincide — the disagreement needs a separator INSIDE the
	// last four characters. Nine digits, five masked, and the character
	// counter masks a sixth.
	{Input: "1234-5678-9", Expected: "****-*678-9"},

	// Four digits: unchanged, not masked. The eager masker stars something.
	{Input: "4242", Expected: "4242"},

	// Fewer than four digits, with a separator for good measure.
	{Input: "12-3", Expected: "12-3"},

	// Which end stays visible. Five digits leave exactly one masked — at
	// the FRONT. The mirror-image implementation masks the back.
	{Input: "12345", Expected: "*2345"},
}
```
