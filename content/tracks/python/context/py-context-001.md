---
slug: py-context-001
title: 'Give it what it needs: a report against a CSV it has never opened'
description: A model asked to total a CSV column will invent the column names — confidently, plausibly, wrong. One source on the menu settles it, and it is not the biggest one.
difficulty: intermediate
type: context
hints:
  - The question needs exactly two facts about the file. Which source states both in the fewest tokens?
  - The sample rows contain the header too — but you pay for twenty rows of data to get one line of names.
  - The pandas manual explains how to read a CSV beautifully. It cannot tell you what is in this one.
tags:
  - context
  - ai
  - cost
---

You are asking a model to write one small script:

> Total the revenue per region from `sales.csv`, highest first.

It has never seen this file. Left alone it will guess column names that
sound right — `region`, `revenue` — and it may even guess correctly, which
is worse: code that works by coincidence on this file and breaks on the next
export, when `Region ` grows a trailing space or revenue turns out to be
`net_revenue`.

Four things could be shown to the model. Each costs what it costs:

| source | tokens |
| --- | --- |
| The header line and column notes | 150 |
| Twenty sample rows | 700 |
| The team style guide | 1800 |
| The pandas manual, IO chapter | 5000 |

Pick what to hand over, then write the script. You are scored on being
right, and separately on what it cost. The sample rows also contain the
header — twenty rows of data as packaging for the one line you needed.

```python
# The script, once you have decided what to hand over.
#
# Write Python against the standard library's csv module. It is checked for
# shape rather than executed: reading sales.csv, grouping on the real region
# column, summing the real revenue column - names you cannot know without
# the one source that states them.
answer = ""
```

## Context

```yaml
required:
  - header
accept: '(?=[\s\S]*sales_region)(?=[\s\S]*net_revenue)(?=[\s\S]*csv)'
sources:
  - id: header
    label: The header line and column notes
    tokens: 150
    content: |
      sales.csv columns:
        order_id      uuid
        sales_region  one of: north, south, east, west
        net_revenue   decimal string, USD, after refunds
        placed_at     ISO 8601

      (Exported nightly; column names are stable, order is not.)
  - id: sample-rows
    label: Twenty sample rows
    tokens: 700
    content: |
      order_id,sales_region,net_revenue,placed_at
      8f31…,north,129.90,2026-08-01T09:12:04Z
      4c02…,west,45.50,2026-08-01T17:45:22Z
      … eighteen more rows in the same shape …
  - id: style-guide
    label: The team style guide
    tokens: 1800
    content: |
      # Python at Acme

      We target 3.12. Scripts use the standard library unless a dependency
      is already in the lockfile. Prefer csv.DictReader over pandas for
      one-off reports …

      … eighteen hundred tokens of naming rules, lint config, and the
      argument about f-strings …
  - id: pandas-manual
    label: The pandas manual, IO chapter
    tokens: 5000
    content: |
      # IO tools

      read_csv accepts a path or buffer. Use dtype= to control column
      types, parse_dates= for timestamps …

      … five thousand tokens on chunking, engines, and na_values …
```

## Tests

```python
import re

# This exercise is not graded by running the learner's code. It is graded by
# the context-selection service: what they chose, what it cost, and whether
# the answer was accepted.
#
# These tests keep the exercise's own definition honest - the definition is
# the thing that decides whether the exercise measures anything.

REQUIRED = ["header"]
SOURCES = [
    {"id": "header", "tokens": 150},
    {"id": "sample-rows", "tokens": 700},
    {"id": "style-guide", "tokens": 1800},
    {"id": "pandas-manual", "tokens": 5000},
]
ACCEPT = re.compile(r"(?=[\s\S]*sales_region)(?=[\s\S]*net_revenue)(?=[\s\S]*csv)", re.I)


def test_required_source_is_on_the_menu():
    ids = [source["id"] for source in SOURCES]
    for required in REQUIRED:
        assert required in ids


def test_required_source_is_the_cheapest():
    # The exercise's whole point: the necessary context costs least. If a
    # pricier source were required, taking everything would be rational.
    required = next(s for s in SOURCES if s["id"] == REQUIRED[0])
    assert all(required["tokens"] <= source["tokens"] for source in SOURCES)


def test_accepts_a_correct_script():
    script = (
        "import csv\n"
        "totals = {}\n"
        "with open('sales.csv') as f:\n"
        "    for row in csv.DictReader(f):\n"
        "        totals[row['sales_region']] = totals.get(row['sales_region'], 0)"
        " + float(row['net_revenue'])\n"
    )
    assert ACCEPT.search(script)


def test_rejects_guessed_column_names():
    # The trap: 'region' and 'revenue' are the guesses that work by
    # coincidence or not at all - either way, unverified.
    script = (
        "import csv\n"
        "for row in csv.DictReader(open('sales.csv')):\n"
        "    totals[row['region']] += float(row['revenue'])\n"
    )
    assert not ACCEPT.search(script)
```

## Solution

```python
# The header notes (150 tokens) are the only source that STATES the column
# names - sales_region and net_revenue, not the guessable region/revenue.
# The sample rows contain the header too, at nearly five times the price;
# the style guide and the pandas manual describe everything about reading
# CSVs except what is in this one.
answer = """
import csv
from collections import defaultdict

totals = defaultdict(float)
with open("sales.csv") as f:
    for row in csv.DictReader(f):
        totals[row["sales_region"]] += float(row["net_revenue"])

for region, total in sorted(totals.items(), key=lambda kv: kv[1], reverse=True):
    print(f"{region}: {total:.2f}")
"""
```
