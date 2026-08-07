---
title: "Working with unknown safely"
slug: "typescript-working-with-unknown"
description: "Use unknown at the boundaries of your program, narrow it deliberately, and understand why a single any spreads further than you expect."
track: "typescript"
order: 6
difficulty: "intermediate"
tags: ["unknown", "any", "type-guards", "type-predicates", "narrowing", "validation"]
practice:
  concept: "basics"
  label: "TypeScript basics"
---

Every program has a boundary where typed code meets values it did not create: a
JSON response, a `localStorage` string, a message from a worker, a thrown value
in a `catch`. TypeScript cannot know the shape of any of those. It gives you two
ways to say so, and they behave in opposite ways.

`any` says "stop checking." `unknown` says "check before you use this."

## Why `any` leaks

`any` is not a type. It is a switch that turns the type checker off for a value,
and the switch travels.

```typescript
const config: any = JSON.parse(raw)

const port = config.port        // any
const host = port.toUpperCase() // any — no error, port is a number
const url = `http://${host}`    // any, and wrong at runtime
```

Nothing above is reported. `any` propagates through property access, through
function returns, and into every variable that touches it, so a single `any` at
a boundary can disable checking in code written months later by someone who
never saw the boundary. The error surfaces at runtime, far from its cause.

This is the actual argument against `any`: not that it is unsafe where you wrote
it — you knew what you were doing there — but that it is unsafe somewhere you
are not looking.

`unknown` is the same idea with the propagation removed. You can assign anything
*to* `unknown`, and you can do almost nothing *with* it until you prove what it
is.

```typescript
const config: unknown = JSON.parse(raw)

config.port // Error: 'config' is of type 'unknown'

const leaked = (config as any).port // Compiles, and you have just re-opened the hole
```

The error is the feature. It appears at the boundary, which is the one place
someone is thinking about the shape of the data.

## Narrowing an unknown

Everything you already know about narrowing applies. `unknown` is just the
widest possible starting point.

```typescript
function describe(value: unknown): string {
  if (typeof value === "string") {
    return value.toUpperCase()
  }
  if (typeof value === "number") {
    return value.toFixed(2)
  }
  if (Array.isArray(value)) {
    return `array of ${value.length}`
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return "unrecognised"
}
```

Objects need one more step, because `typeof x === "object"` is true for `null`
and tells you nothing about properties:

```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readPort(value: unknown): number | null {
  if (!isRecord(value)) return null
  if (typeof value["port"] !== "number") return null
  return value["port"]
}
```

`Record<string, unknown>` is the useful intermediate step. Its values are still
`unknown`, so you keep having to check as you drill in, one level at a time.
That is tedious exactly in proportion to how little you actually know about the
input.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function describe(value: unknown): string {
    if (___blank_start___typeof___blank_end___ value === "string") {
      return value.toUpperCase()
    }
    return "unrecognised"
  }
---
::

## Type predicates, and what they cost

A function returning `value is T` teaches the compiler something it cannot
verify. That is the point, and it is also the risk: a predicate is an assertion
with better manners.

```typescript
interface User {
  id: string
  name: string
}

function isUser(value: unknown): value is User {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string"
  )
}
```

That predicate checks every property in the type, so the claim it makes is true.
This one is not:

```typescript
function isUser(value: unknown): value is User {
  return isRecord(value) && "id" in value // never checked name
}
```

It compiles, it narrows, and every caller now treats `user.name` as a `string`
that may be `undefined`. A predicate that under-checks is a cast that nobody
will review as one, because it does not contain the word `as`.

The rule that keeps this honest: a predicate must check every property of the
type it claims. When the type grows a field, the predicate has to grow a check —
and nothing in the compiler will remind you, which is why predicates belong in
one small module you can read in full rather than scattered across the codebase.

If you find yourself writing many of these by hand, that is the signal to reach
for a schema validation library. The narrowing is the same; the difference is
that the checks are derived from the type rather than maintained in parallel
with it.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function isUser(value: unknown): value ___blank_start___is___blank_end___ User {
    return (
      isRecord(value) &&
      typeof value["id"] === "string" &&
      typeof value["name"] === "string"
    )
  }
---
::

## Assertion functions at a boundary

When a bad value means the operation cannot continue, an assertion function is
tighter than a predicate, because it narrows the rest of the enclosing scope
rather than one branch.

```typescript
function assertIsUser(value: unknown): asserts value is User {
  if (!isUser(value)) {
    throw new TypeError("Expected a User")
  }
}

async function loadUser(id: string): Promise<User> {
  const body: unknown = await fetch(`/api/users/${id}`).then((r) => r.json())
  assertIsUser(body)
  return body // User, for the rest of the function
}
```

Note the explicit `: unknown` annotation on `body`. Without it the value is
`any`, because `Response.json()` is typed as returning `Promise<any>` — the leak
this whole page is about, sitting in the standard library on the most common
boundary in a web application.

`JSON.parse` has the same signature. Wrapping it once is worth it:

```typescript
export function parseJson(text: string): unknown {
  return JSON.parse(text)
}
```

That single-line function changes the default for every caller: instead of
receiving permission to skip checking, they receive a value they have to
inspect.

## Errors are unknown

With `useUnknownInCatchVariables` enabled — it is included in `strict` — a
caught value is `unknown`, which is correct: JavaScript permits throwing
anything, and plenty of libraries throw strings.

```typescript
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

try {
  await save(record)
} catch (error) {
  logger.error(messageOf(error))
}
```

`error.message` inside the `catch` is the single most common place `any` gets
reintroduced, usually as `catch (error: any)`. One helper removes the temptation
everywhere. The rule for this whole page is that small: use `unknown` where data
enters your program, narrow it once, deliberately, at that boundary, and
everything downstream works with real types.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function messageOf(error: unknown): string {
    if (error ___blank_start___instanceof___blank_end___ Error) return error.message
    return "Unknown error"
  }
---
::

## Where this bites

**Banning `any` outright.** Sometimes a third-party type definition is wrong, or
you're writing the internals of a generic utility where the type genuinely can't
be spoken, and `any` is the tool for that — contained to one line with a comment
saying why, and a typed value on the way back out:

```typescript
// The upstream types omit the callback overload; verified against v4.2 source.
const client = createClient(options) as any as TypedClient
```

The problem was never the keyword. It's `any` values escaping into code that
never agreed to handle them.

**`catch (error: any)`.** It reintroduces the exact leak this page is about, at
the single most common boundary in a web application. Annotate the caught value
as `unknown` — or leave it unannotated, since `useUnknownInCatchVariables` makes
that the default under `strict` — and write one `messageOf` helper the whole
codebase can share.

**A predicate that checks one property and claims the whole type.** `isUser`
returning `isRecord(value) && "id" in value` compiles, narrows, and quietly ships
`user.name` as a `string` that is actually `undefined` everywhere it's read.
Review a predicate as the cast it secretly is, and confirm it checks every
property in the type it claims to prove.

**Trusting `JSON.parse` or `response.json()` without an explicit `unknown`
annotation.** Both are typed to return `any` in the standard library, so the
moment you write `const data = await res.json()` with no annotation, the leak
has already happened, silently, on the most common boundary in the app. Wrap
them once so every caller receives a value they have to inspect before they can
use it.
