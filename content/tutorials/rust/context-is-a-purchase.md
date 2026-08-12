---
title: "Context Is a Purchase"
slug: "rust-context-is-a-purchase"
description: "A model missing a local fact does not fail — it invents, fluently. The skill is naming the fact you need, buying the cheapest source that states it, and refusing the sources that merely look relevant."
track: "rust"
order: 7
difficulty: "intermediate"
tags: ["ai", "context", "cost", "sql"]
practice:
  concept: "context"
  label: "Give it what it needs"
---

A model knows Rust, SQL, every crates.io pattern, and the shape of a thousand REST APIs. It does not know your database, your route table, or what your team named anything. Every task that touches a system the model has never seen splits along that line: general knowledge it already has, and local facts it cannot possibly have. Context is how you sell it the local facts — and every token of it is bought, whether you priced it or not.

## What the model cannot know

Ask for a query against a schema the model has never seen and it will not stop to say so. It will write the query anyway, with column names that sound right — `amount`, `created_at`, `user_id` — because plausible invention is what a model does with a gap. The result is fluent, well-formatted, and does not run.

That is the failure mode that makes under-buying invisible: missing context does not produce an error message, it produces confidence. Nothing in the output marks the line where knowledge ran out and invention began — the invented column name is rendered with exactly as much certainty as the correct keyword next to it. You cannot see the seam by reading. You can only know where it has to be: everything local is on the far side of it.

## When the wrong guess runs

Sometimes invention is worse than wrong — it is *runnable*. Ask a model to cancel order `ord_4821` against an API it has never read and it will guess the RESTful default: `DELETE /api/orders/ord_4821`. On a real API that endpoint can exist, return 200, and do the wrong thing — delete a draft, say, when live orders are cancelled through `POST /api/orders/:id/cancel`. Nothing about the response says "wrong endpoint". The convention the model learned from a thousand other APIs is precisely what makes its guess dangerous on yours.

The fact that prevents this costs almost nothing. A route table — one line per route, a couple hundred tokens — states the endpoint outright. The full OpenAPI dump states it too, buried in four thousand tokens of schemas, the way a phone book contains your dentist.

::code-blank{lang="rust" href="/tracks/rust/context" label="practice give it what it needs for real"}
---
code: |
  let req = Request::builder()
      .method("___blank_start___POST___blank_end___")
      .uri(format!("/api/orders/{id}/___blank_start___cancel___blank_end___"))
      .body(())?;
---
::

## Name the fact, then buy the source that states it

Before reaching for anything, ask what a competent person would need in front of them to do the task. Not what would be nice to have open in a tab — what is *required*. For "total order value per customer over the last thirty days, highest first", the required fact is which tables and columns exist. That is the whole list.

Now price the menu. Say these four things are available:

| source | tokens |
| --- | --- |
| Table definitions | 400 |
| Twenty example rows | 900 |
| The ORM manual | 6000 |
| Yesterday's slow-query log | 3000 |

The table definitions — `orders(id, customer_id, total_cents, placed_at, status)` — answer the question at 400 tokens. The manual is fifteen times the price and answers a different question: how the tool works, which the model already knows from training. The slow-query log describes yesterday's problems. The example rows show you data whose shape you already own once you have the definitions. The decisive source is the cheapest one here, and that is not a coincidence: it is the most *specific* one, and specificity is the only thing the model lacks. You are not buying knowledge — it has knowledge. You are buying the local delta.

::code-blank{lang="sql" href="/tracks/rust/context" label="practice give it what it needs for real"}
---
code: |
  select customer_id, ___blank_start___sum___blank_end___(total_cents) as total_value
  from orders
  where placed_at >= now() - interval '30 days'
  group by ___blank_start___customer_id___blank_end___
  order by total_value desc
---
::

## More context is not a safer bet

The instinct under uncertainty is to hand over everything — schema, rows, manual, logs — and let the model sort it out. That habit has two costs, and both are quiet.

The first is the bill. Everything on the menu above costs sixteen times the necessary price, and context is priced per call: a "just in case" source that rides along in an agent loop is not a one-time expense, it is a tax on every iteration. The answer comes back right either way, which is exactly why the habit survives — over-buying has no visible failure. The correctness of the answer says nothing about what it cost, so the two have to be measured separately, or the second one silently grows.

The second cost is quality. Irrelevant context is not neutral padding; it is material the model will try to use. Hand over a full Diesel guide alongside a request for raw SQL and the answer drifts toward the manual's idioms. Hand over twenty example rows and a column that happens to be null in all of them reads as optional — the rows show what happens to be there, while the definitions state what can be there. Every unnecessary source is another surface the model can anchor on, and it does not tell you when it has.

## Where this bites

**Pasting the whole crate to ask about one function.** The rest of the file is anchor material, and it is billed on every message of the conversation that follows. Excerpt the function and the types it touches; that is the local delta, and it is small.

**Reading a confident answer as proof the context was sufficient.** Fluency is what invention looks like too. Check the one fact that had to come from context — the column name, the route — against the source you bought, or run the result. Those are the only two tests that mean anything.

**Buying documentation to answer a local question.** Manuals, guides, and tutorials describe the tool, and the tool is general knowledge the model already carries. If the question is about *your* system, the answer lives in an artifact of your system — schema, route table, config — and those are almost always the cheapest things on the menu.

**Letting a "just in case" source ride along.** Paying sixteen times once is trivia. Paying it on every call of a loop that runs all day is the line item that makes someone audit the prompt — and the audit always finds the manual nobody read, attached since the first commit.
