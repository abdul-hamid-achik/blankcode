---
slug: py-tool-002
title: 'Build the tool: find the fence nobody closed'
description: A markdown file with an unclosed code fence ships looking fine and renders broken — everything after the fence becomes code. Two shipped here in one day. Write the rule.
difficulty: beginner
type: challenge
hints:
  - Count fence delimiters per file. What does an odd count at end-of-file mean?
  - An opening fence may carry a language tag; a closing one is bare. You do not need to tell them apart if you count transitions.
  - Report the line where the unclosed fence OPENED - that is where the author has to look, not the end of the file.
tags:
  - tooling
  - markdown
  - validation
---

This exercise is real. This platform's exercises are markdown files full of
fenced code blocks, and twice in one day a file shipped with its final
fence unclosed - the author wrote the closing code, and not the closing
delimiter. Markdown does not error: everything after the open fence
becomes one endless code block, the sections below it vanish, and the
file looks complete in an editor because the content is all there.

Both were caught by a validator, in milliseconds, at the door. That rule
deserves to exist everywhere markdown does.

Write `find_unclosed_fences`. It scans documents and reports every fence
that opens and never closes. A fence is a line whose first non-space
characters are three backticks; an opening fence may carry a language tag
after the backticks. Fences do not nest - inside an open fence, the next
fence line closes it.

```python
def find_unclosed_fences(docs):
    """Reports every code fence that opens and never closes.

    docs is a list of {"path": str, "text": str}. Returns a list of
    {"path": str, "line": int} - the 1-based line where the unclosed
    fence opened - in input order.
    """
    return []
```

## Tests

```python
FENCE = chr(96) * 3  # three backticks, composed so this file's own fences stay closed


def doc(path, *lines):
    return {"path": path, "text": "\n".join(lines)}


def test_clean_document_reports_nothing():
    clean = doc("a.md", "# Title", FENCE + "python", "x = 1", FENCE, "after")
    assert find_unclosed_fences([clean]) == []


def test_reports_an_unclosed_fence_at_its_opening_line():
    # The line the author must look at is where the fence OPENED - the end
    # of the file is just where the damage stops accumulating.
    broken = doc("b.md", "intro", FENCE + "python", "x = 1")
    assert find_unclosed_fences([broken]) == [{"path": "b.md", "line": 2}]


def test_language_tags_do_not_matter():
    broken = doc("c.md", FENCE, "plain fence, never closed")
    assert find_unclosed_fences([broken]) == [{"path": "c.md", "line": 1}]


def test_two_blocks_second_unclosed():
    broken = doc(
        "d.md",
        FENCE + "go",
        "a := 1",
        FENCE,
        "prose between",
        FENCE + "go",
        "b := 2",
    )
    assert find_unclosed_fences([broken]) == [{"path": "d.md", "line": 5}]


def test_indented_fences_count():
    # Authors indent fences inside lists; the rule follows them there.
    broken = doc("e.md", "- item", "  " + FENCE + "python", "  x = 1")
    assert find_unclosed_fences([broken]) == [{"path": "e.md", "line": 2}]


def test_backticks_inside_an_open_fence_close_it():
    # Fences do not nest: the second delimiter closes, whatever follows is
    # prose again, and the third opens the fence that never closes.
    broken = doc("f.md", FENCE, "code", FENCE, "prose", FENCE)
    assert find_unclosed_fences([broken]) == [{"path": "f.md", "line": 5}]


def test_multiple_files_in_input_order():
    ok = doc("g.md", FENCE, "x", FENCE)
    bad1 = doc("h.md", FENCE + "python", "x")
    bad2 = doc("i.md", "text", FENCE + "go", "y")
    assert find_unclosed_fences([ok, bad1, bad2]) == [
        {"path": "h.md", "line": 1},
        {"path": "i.md", "line": 2},
    ]


def test_empty_input():
    assert find_unclosed_fences([]) == []
```

## Solution

```python
def find_unclosed_fences(docs):
    """Reports every code fence that opens and never closes.

    docs is a list of {"path": str, "text": str}. Returns a list of
    {"path": str, "line": int} - the 1-based line where the unclosed
    fence opened - in input order.
    """
    # Composed, not written literally: this function ships inside a markdown
    # exercise file, and a literal triple backtick in its body would close
    # that file's own fence - the exact bug it detects.
    fence = chr(96) * 3
    findings = []

    for document in docs:
        # Fences toggle: outside -> a fence line opens; inside -> the next
        # fence line closes, regardless of language tags. So the whole
        # check is tracking that toggle and remembering where the last
        # OPEN happened - the line the author needs, since end-of-file is
        # only where the damage stops.
        open_line = None
        for number, line in enumerate(document["text"].split("\n"), start=1):
            if line.lstrip().startswith(fence):
                open_line = number if open_line is None else None

        if open_line is not None:
            findings.append({"path": document["path"], "line": open_line})

    return findings
```
