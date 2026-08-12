---
title: "Context Is a Purchase"
slug: "react-context-is-a-purchase"
description: "A model missing a local fact does not fail — it invents, fluently. The skill is naming the fact you need, buying the cheapest source that states it, and refusing the sources that merely look relevant."
track: "react"
order: 7
difficulty: "intermediate"
tags: ["ai", "context", "cost", "sql"]
practice:
  concept: "context"
  label: "Give it what it needs"
---

A model knows React, TypeScript, SQL, and the shape of a thousand REST APIs. It does not know your database, your route table, or what your team named anything. Every task that touches a system the model has never seen splits along that line: general knowledge it already has, and local facts it cannot possibly have. Context is how you sell it the local facts — and every token of it is bought, whether you priced it or not.

## What the model cannot know

Ask for a query against a schema the model has never seen and it will not stop to say so. It will write the query anyway, with column names that sound right — `amount`, `created_at`, `user_id` — because plausible invention is what a model does with a gap. The result is fluent, well-formatted, and does not run.

That is the failure mode that makes under-buying invisible: missing context does not produce an error message, it produces confidence. You cannot see the seam by reading. You can only know where it has to be: everything local is on the far side of it.

## When the wrong guess runs

Sometimes invention is worse than wrong — it is *runnable*. Ask a model to cancel order `ord_4821` against an API it has never read and it will guess the RESTful default: `DELETE /api/orders/ord_4821`. On a real API that endpoint can exist, return 200, and do the wrong thing — delete a draft when live orders are cancelled through `POST /api/orders/:id/cancel`.

The fact that prevents this costs almost nothing. A route table — one line per route, a couple hundred tokens — states the endpoint outright. The full OpenAPI dump states it too, buried in four thousand tokens of schemas.

::code-blank{lang="typescript" href="/tracks/react/context" label="practice give it what it needs for real"}
---
code: |
  await fetch(`/api/orders/${id}/___blank_start___cancel___blank_end___`, {
    method: '___blank_start___POST___blank_end___',
  })
---
::

## Name the fact, then buy the source that states it

Before reaching for anything, ask what a competent person would need in front of them to do the task. Not what would be nice to have open in a tab — what is *required*. For "total order value per customer over the last thirty days, highest first", the required fact is which tables and columns exist.

Now price the menu:

| source | tokens |
| --- | --- |
| Table definitions | 400 |
| Twenty example rows | 900 |
| The ORM manual | 6000 |
| Yesterday's slow-query log | 3000 |

The table definitions — `orders(id, customer_id, total_cents, placed_at, status)` — answer the question at 400 tokens. The manual is fifteen times the price and answers a different question. The decisive source is the cheapest one here: the most *specific* one. You are not buying knowledge — it has knowledge. You are buying the local delta.

::code-blank{lang="sql" href="/tracks/react/context" label="practice give it what it needs for real"}
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

The instinct under uncertainty is to hand over everything. That habit has two costs, and both are quiet.

The first is the bill. Context is priced per call: a "just in case" source in an agent loop is a tax on every iteration. Over-buying has no visible failure.

The second cost is quality. Irrelevant context is material the model will try to use. Hand over the Redux docs alongside a request for raw SQL and the answer drifts toward the manual's idioms. Every unnecessary source is another surface the model can anchor on.

## Where this bites

**Pasting the whole component tree to ask about one hook.** The rest is anchor material, billed on every message that follows. Excerpt the function and the types it touches.

**Reading a confident answer as proof the context was sufficient.** Fluency is what invention looks like too. Check the one fact that had to come from context against the source you bought, or run the result.

**Buying documentation to answer a local question.** Manuals describe the tool; if the question is about *your* system, the answer lives in an artifact of your system.

**Letting a "just in case" source ride along.** Paying sixteen times once is trivia. Paying it on every call of a loop that runs all day is the line item that makes someone audit the prompt.
