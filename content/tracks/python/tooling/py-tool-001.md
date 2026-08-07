---
slug: py-tool-001
title: 'Build the tool: find the records one import silently overwrites'
description: Two files claiming the same identifier is not an error anywhere — the importer upserts, and the second quietly replaces the first. Write the check that finds the collision before the data is gone.
difficulty: intermediate
type: challenge
hints:
  - The collision is per group, not global. The same slug under two different parents is fine.
  - Report every file in a colliding set, not just the second one. You cannot tell which was meant to win.
  - A file with no slug at all is a different problem and should not be reported as a duplicate.
tags:
  - tooling
  - data-integrity
  - validation
---

This exercise is real. Content in this platform is markdown with frontmatter,
and the importer upserts on `(parent, slug)`. Two files under the same parent
claiming the same slug is not an error at any layer: both parse, both import,
and the second silently overwrites the first. The exercise you wrote just
disappears, and the only symptom is a number that should have gone up and did
not.

Nothing catches that except a check that looks across files — which is why it
has to be a tool and not a habit.

Write `find_slug_collisions`.

```python
def find_slug_collisions(documents):
    """Finds slugs claimed by more than one document under the same parent.

    `documents` is a list of dicts with:
      - "path":   where the document came from
      - "parent": the group it belongs to; the same slug under two different
                  parents is not a collision
      - "slug":   the identifier it claims, or None if it declares none

    Returns a list of dicts, one per colliding slug:
      {"parent": ..., "slug": ..., "paths": [...]}

    `paths` holds every file in the collision, in the order given, and the
    result is sorted by parent then slug so the output is stable.
    """
    # Your implementation here
    return []
```

## Tests

```python
def doc(path, parent, slug):
    return {"path": path, "parent": parent, "slug": slug}


def test_no_collisions():
    assert find_slug_collisions([doc("a.md", "go", "one"), doc("b.md", "go", "two")]) == []


def test_finds_a_collision():
    result = find_slug_collisions([doc("a.md", "go", "same"), doc("b.md", "go", "same")])

    assert len(result) == 1
    assert result[0]["slug"] == "same"
    assert result[0]["parent"] == "go"


def test_reports_every_file_in_the_collision():
    # Not just the one that overwrote: you cannot tell which was meant to win,
    # so a report naming only the loser sends the reader to the wrong file.
    result = find_slug_collisions([doc("a.md", "go", "same"), doc("b.md", "go", "same")])
    assert result[0]["paths"] == ["a.md", "b.md"]


def test_reports_three_way_collisions():
    result = find_slug_collisions(
        [doc("a.md", "go", "x"), doc("b.md", "go", "x"), doc("c.md", "go", "x")]
    )

    assert len(result) == 1
    assert result[0]["paths"] == ["a.md", "b.md", "c.md"]


def test_same_slug_under_different_parents_is_fine():
    assert find_slug_collisions([doc("a.md", "go", "intro"), doc("b.md", "rust", "intro")]) == []


def test_ignores_documents_without_a_slug():
    # A missing slug is a different defect. Reporting it here would bury the
    # collisions under noise and make the tool the thing people ignore.
    assert find_slug_collisions([doc("a.md", "go", None), doc("b.md", "go", None)]) == []


def test_a_missing_slug_does_not_join_a_collision():
    result = find_slug_collisions(
        [doc("a.md", "go", "x"), doc("b.md", "go", None), doc("c.md", "go", "x")]
    )

    assert len(result) == 1
    assert result[0]["paths"] == ["a.md", "c.md"]


def test_finds_several_collisions():
    result = find_slug_collisions(
        [
            doc("a.md", "go", "x"),
            doc("b.md", "go", "x"),
            doc("c.md", "rust", "y"),
            doc("d.md", "rust", "y"),
        ]
    )

    assert len(result) == 2


def test_result_is_sorted_by_parent_then_slug():
    # A tool that reports in hash order produces a different diff every run,
    # which makes it useless in CI.
    result = find_slug_collisions(
        [
            doc("a.md", "rust", "b"),
            doc("b.md", "rust", "b"),
            doc("c.md", "go", "z"),
            doc("d.md", "go", "z"),
            doc("e.md", "go", "a"),
            doc("f.md", "go", "a"),
        ]
    )

    assert [(r["parent"], r["slug"]) for r in result] == [
        ("go", "a"),
        ("go", "z"),
        ("rust", "b"),
    ]


def test_empty_input():
    assert find_slug_collisions([]) == []


def test_a_single_document_never_collides():
    assert find_slug_collisions([doc("a.md", "go", "only")]) == []
```

## Solution

```python
from collections import defaultdict


def find_slug_collisions(documents):
    """Finds slugs claimed by more than one document under the same parent."""
    # Keyed on (parent, slug) because the collision is scoped to the parent —
    # the same slug under two different groups is not a conflict, and treating
    # it as one would make the tool cry wolf on a perfectly ordinary corpus.
    claims = defaultdict(list)

    for document in documents:
        slug = document.get("slug")
        # A missing slug is a different defect with a different fix. Folding it
        # in here would bury the collisions in noise, and a noisy tool is one
        # people learn to ignore.
        if not slug:
            continue
        claims[(document["parent"], slug)].append(document["path"])

    collisions = [
        {"parent": parent, "slug": slug, "paths": paths}
        for (parent, slug), paths in claims.items()
        if len(paths) > 1
    ]

    # Sorted so the output is stable across runs: a tool whose report reorders
    # itself produces a fresh diff every time and cannot be used in CI.
    collisions.sort(key=lambda finding: (finding["parent"], finding["slug"]))
    return collisions
```
