---
slug: go-tool-001
title: 'Build the tool: find the error chain broken by one verb'
description: An error wrapped with %v reads identically to one wrapped with %w and behaves nothing like it. One of those shipped here. Write the rule that finds every one.
difficulty: intermediate
type: challenge
hints:
  - The signal is an fmt.Errorf whose format uses %v while an error is among the arguments. Both facts are visible on the line.
  - An argument is error-ish when its name is err, ends in Err, or starts with Err — the sentinel convention ErrNotFound follows.
  - '%w in the same format means the chain is intact; that line is not a finding even if %v also appears.'
tags:
  - tooling
  - errors
  - static-analysis
---

This exercise is real. This platform's Go track shipped a lookup helper
whose missing-key error was built with `fmt.Errorf("lookup %q: %v", key,
ErrNotFound)`. The message read perfectly. `errors.Is` returned false
forever — `%v` formats the sentinel into the text and drops it from the
chain, and `%w` is one character away. Every test that matched message
substrings passed, because the substring is identical either way.

Reading does not catch this: the two verbs look alike and the bug only
shows at a call site three packages away. A rule catches it on every line,
forever.

Write `FindBrokenWraps`. It scans Go source and reports every line
containing an `fmt.Errorf` call whose format string uses `%v` while an
error value is among the arguments — an identifier named `err`, ending in
`Err`, or starting with `Err` (the sentinel convention). A format that uses
`%w` anywhere keeps its chain and is never a finding, even if `%v` also
appears in it.

```go
package main

// Finding is one fmt.Errorf that formats an error instead of wrapping it.
type Finding struct {
	// File is the path, as given.
	File string
	// Line is 1-based.
	Line int
}

// SourceFile is one Go file to scan.
type SourceFile struct {
	Path     string
	Contents string
}

// FindBrokenWraps reports every line with an fmt.Errorf whose format uses
// %v while an error-ish argument (err, ending in Err, or starting with
// Err) is present, and whose format does not use %w.
func FindBrokenWraps(files []SourceFile) []Finding {
	// Your implementation here
	return nil
}
```

## Tests

```go
package main

import (
	"reflect"
	"testing"
)

func file(path string, contents string) SourceFile {
	return SourceFile{Path: path, Contents: contents}
}

func TestReportsAVerbWrappedSentinel(t *testing.T) {
	source := "package lookup\n" +
		"func Lookup() error {\n" +
		"\treturn fmt.Errorf(\"lookup %q: %v\", key, ErrNotFound)\n" +
		"}\n"
	got := FindBrokenWraps([]SourceFile{file("lookup.go", source)})
	want := []Finding{{File: "lookup.go", Line: 3}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestReportsPlainErr(t *testing.T) {
	source := "package a\n" +
		"var x = fmt.Errorf(\"open config: %v\", err)\n"
	got := FindBrokenWraps([]SourceFile{file("a.go", source)})
	if len(got) != 1 || got[0].Line != 2 {
		t.Fatalf("got %v", got)
	}
}

func TestAcceptsAProperWrap(t *testing.T) {
	source := "package a\n" +
		"var x = fmt.Errorf(\"open config: %w\", err)\n"
	if got := FindBrokenWraps([]SourceFile{file("a.go", source)}); len(got) != 0 {
		t.Fatalf("a %%w wrap is intact, got %v", got)
	}
}

func TestAcceptsVerbWithWPresent(t *testing.T) {
	// %v may legitimately format a non-error alongside a %w wrap on the
	// same line. The chain is intact; not a finding.
	source := "package a\n" +
		"var x = fmt.Errorf(\"op %v failed: %w\", name, err)\n"
	if got := FindBrokenWraps([]SourceFile{file("a.go", source)}); len(got) != 0 {
		t.Fatalf("%%w keeps the chain, got %v", got)
	}
}

func TestIgnoresVerbWithoutErrorArguments(t *testing.T) {
	// %v formatting an ordinary value is what %v is for.
	source := "package a\n" +
		"var x = fmt.Errorf(\"bad port %v\", port)\n"
	if got := FindBrokenWraps([]SourceFile{file("a.go", source)}); len(got) != 0 {
		t.Fatalf("no error-ish argument here, got %v", got)
	}
}

func TestMatchesSuffixedErrorNames(t *testing.T) {
	source := "package a\n" +
		"var x = fmt.Errorf(\"save: %v\", saveErr)\n" +
		"var y = fmt.Errorf(\"load: %v\", loadErr)\n"
	got := FindBrokenWraps([]SourceFile{file("a.go", source)})
	if len(got) != 2 || got[0].Line != 2 || got[1].Line != 3 {
		t.Fatalf("got %v", got)
	}
}

func TestReportsAcrossFilesInOrder(t *testing.T) {
	clean := file("clean.go", "package a\nvar x = fmt.Errorf(\"ok: %w\", err)\n")
	dirty := file("dirty.go", "package b\nvar y = fmt.Errorf(\"no: %v\", err)\n")
	got := FindBrokenWraps([]SourceFile{clean, dirty})
	want := []Finding{{File: "dirty.go", Line: 2}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestEmptyInput(t *testing.T) {
	if got := FindBrokenWraps(nil); len(got) != 0 {
		t.Fatalf("got %v", got)
	}
}
```

## Solution

```go
package main

import (
	"regexp"
	"strings"
)

// Finding is one fmt.Errorf that formats an error instead of wrapping it.
type Finding struct {
	File string
	Line int
}

// SourceFile is one Go file to scan.
type SourceFile struct {
	Path     string
	Contents string
}

// One line is enough context: fmt.Errorf calls put the format literal and
// the arguments on the same line in the overwhelmingly common case, and a
// rule that catches the common case every time beats a parser nobody
// writes.
var errorfLine = regexp.MustCompile(`fmt\.Errorf\((".*?")((?:\s*,[^)]*)?)\)`)
var errArgument = regexp.MustCompile(`(?:^|[^\w])(?:err\b|\w*Err\b|Err\w*)`)

// FindBrokenWraps reports every line with an fmt.Errorf whose format uses
// %v while an error-ish argument (err, ending in Err, or starting with
// Err) is present, and whose format does not use %w.
func FindBrokenWraps(files []SourceFile) []Finding {
	var findings []Finding

	for _, f := range files {
		for i, line := range strings.Split(f.Contents, "\n") {
			match := errorfLine.FindStringSubmatch(line)
			if match == nil {
				continue
			}
			format, args := match[1], match[2]
			// %w anywhere in the format keeps the chain — that call is
			// doing its job, whatever else %v formats alongside.
			if strings.Contains(format, "%w") {
				continue
			}
			if !strings.Contains(format, "%v") {
				continue
			}
			if errArgument.MatchString(args) {
				findings = append(findings, Finding{File: f.Path, Line: i + 1})
			}
		}
	}

	return findings
}
```
