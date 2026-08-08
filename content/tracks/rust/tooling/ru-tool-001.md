---
slug: ru-tool-001
title: 'Build the tool: find the unwrap waiting for production'
description: A leaderboard here panicked on one NaN because of a single .unwrap() that read as confidence. Write the rule that finds every unwrap outside the tests, where a panic is an outage.
difficulty: intermediate
type: challenge
hints:
  - The signal is the string .unwrap() on a line. The judgement is where the line lives.
  - Test modules sit at the bottom of the file behind cfg(test) by convention — the rule leans on that convention rather than parsing modules.
  - Count occurrences, not lines — two unwraps on one line are two findings waiting to fire.
tags:
  - tooling
  - panics
  - static-analysis
---

This exercise is real. This platform's Rust track shipped a leaderboard
helper that sorted with `partial_cmp(a).unwrap()`. Every test passed —
every score in them was a clean float — and the first NaN in real data
panicked the thread. The `.unwrap()` read as confidence. It was a deferral:
"this cannot fail" spelled in a way the compiler stops asking about.

In a test, unwrap is fine — a panic *is* the failure report. In library
code it is somebody else's outage. The two live in the same file, which is
why reading misses them and a rule does not.

Write `find_unwraps`. It scans Rust source and reports every occurrence of
`.unwrap()` that appears *before* the file's `#[cfg(test)]` line — the
convention that puts test modules at the bottom of the file. Everything
from that line down is test code and exempt. A line with two unwraps is two
findings.

```rust
/// One production unwrap: the file and its 1-based line.
#[derive(Debug, PartialEq)]
pub struct Finding {
    pub file: String,
    pub line: usize,
}

/// One Rust file to scan: (path, contents).
pub type SourceFile = (String, String);

/// Reports every `.unwrap()` occurrence before the file's `#[cfg(test)]`
/// line, in file order then line order. Two on one line are two findings.
pub fn find_unwraps(files: &[SourceFile]) -> Vec<Finding> {
    // Your implementation here
    Vec::new()
}
```

## Tests

```rust
fn file(path: &str, contents: &str) -> (String, String) {
    (path.to_string(), contents.to_string())
}

#[test]
fn reports_a_production_unwrap() {
    let source = "pub fn top() -> f64 {\n    scores.first().unwrap()\n}\n";
    let got = find_unwraps(&[file("lib.rs", source)]);
    assert_eq!(
        got,
        vec![Finding { file: "lib.rs".to_string(), line: 2 }]
    );
}

#[test]
fn exempts_everything_below_cfg_test() {
    let source = "pub fn top() -> f64 {\n    1.0\n}\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn t() {\n        top().to_string().parse::<f64>().unwrap();\n    }\n}\n";
    let got = find_unwraps(&[file("lib.rs", source)]);
    assert!(got.is_empty(), "test-module unwraps are the point of tests: {got:?}");
}

#[test]
fn production_before_tests_still_counts() {
    let source = "pub fn top() -> f64 {\n    scores.first().unwrap()\n}\n#[cfg(test)]\nmod tests {\n    fn t() {\n        top().to_string().parse::<f64>().unwrap();\n    }\n}\n";
    let got = find_unwraps(&[file("lib.rs", source)]);
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].line, 2);
}

#[test]
fn two_unwraps_on_one_line_are_two_findings() {
    let source = "let x = a.unwrap() + b.unwrap();\n";
    let got = find_unwraps(&[file("math.rs", source)]);
    assert_eq!(got.len(), 2);
    assert_eq!(got[0].line, 1);
    assert_eq!(got[1].line, 1);
}

#[test]
fn unwrap_or_variants_are_not_findings() {
    // unwrap_or and friends HANDLE the None/Err case — they are the fix,
    // not the bug, and a rule that flags them teaches people to ignore it.
    let source = "let x = a.unwrap_or(0);\nlet y = b.unwrap_or_else(|| 1);\nlet z = c.unwrap_or_default();\n";
    let got = find_unwraps(&[file("ok.rs", source)]);
    assert!(got.is_empty(), "unwrap_or handles the case: {got:?}");
}

#[test]
fn reports_across_files_in_order() {
    let clean = file("clean.rs", "pub fn ok() -> u64 { 1 }\n");
    let dirty = file("dirty.rs", "pub fn no() -> u64 { x.unwrap() }\n");
    let got = find_unwraps(&[clean, dirty]);
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].file, "dirty.rs");
}

#[test]
fn empty_input() {
    assert!(find_unwraps(&[]).is_empty());
}
```

## Solution

```rust
/// One production unwrap: the file and its 1-based line.
#[derive(Debug, PartialEq)]
pub struct Finding {
    pub file: String,
    pub line: usize,
}

/// One Rust file to scan: (path, contents).
pub type SourceFile = (String, String);

/// Reports every `.unwrap()` occurrence before the file's `#[cfg(test)]`
/// line, in file order then line order. Two on one line are two findings.
pub fn find_unwraps(files: &[SourceFile]) -> Vec<Finding> {
    let mut findings = Vec::new();

    for (path, contents) in files {
        for (index, line) in contents.lines().enumerate() {
            // The convention IS the parser: test modules sit at the bottom
            // behind #[cfg(test)], so the first sighting ends the
            // production region. Leaning on a convention the codebase
            // already keeps beats a module parser nobody will maintain.
            if line.contains("#[cfg(test)]") {
                break;
            }
            // ".unwrap()" exactly — unwrap_or and friends HANDLE the empty
            // case and must not be flagged, or the rule trains everyone to
            // ignore it. Counting matches, not lines: each occurrence is
            // its own panic waiting to fire.
            for _ in line.matches(".unwrap()") {
                findings.push(Finding { file: path.clone(), line: index + 1 });
            }
        }
    }

    findings
}
```
