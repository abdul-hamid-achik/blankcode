---
title: "Getting Started with TypeScript"
slug: "typescript-getting-started"
description: "What to annotate versus what to let TypeScript infer, why const narrows to a literal type, and why a literal union usually beats an enum."
track: "typescript"
order: 1
difficulty: "beginner"
tags: ["types", "fundamentals", "type-inference", "union-types", "enums", "functions"]
practice:
  concept: "basics"
  label: "TypeScript basics"
---

TypeScript adds one thing to JavaScript: a checker that reads your code before it runs and rejects programs where the types don't add up. The runtime semantics are unchanged — a `for` loop still means the same thing, `this` still binds the same way — so learning TypeScript is really learning what the checker infers when you say nothing, and when you need to say something instead.

## Primitives, and when to annotate them yourself

The primitive types read the way you'd expect:

```typescript
const userName: string = "Alice"
const age: number = 30
const isActive: boolean = true

const scores: number[] = [95, 87, 92]
const pair: [string, number] = ["age", 30] // tuple — fixed length, per-position types
```

None of those annotations are doing real work — TypeScript would infer every one of them from the initializer. The annotation earns its place on a function parameter, because a parameter has no initializer to infer from:

```typescript
function double(n: number) {
  return n * 2 // return type inferred as number — no need to write it
}
```

That's the rule worth keeping: annotate parameters, because the compiler has nothing to infer them from; let it infer variables and return types unless the function is a public API boundary, where a written return type catches you accidentally widening it later.

`const` does more than block reassignment. It also narrows the type to the literal value:

```typescript
const direction = "north" // type: "north"
let heading = "north"     // type: string
```

`direction` can only ever be `"north"` — TypeScript knows the value never changes, so it keeps the most precise type it can. `heading` might be reassigned, so TypeScript widens it to the general `string` type immediately. This is why a `const` object literal passed where a union of string literals is expected type-checks, and the `let` equivalent often doesn't without an explicit annotation.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function double(n: ___blank_start___number___blank_end___) {
    return n * 2
  }
---
::

## Interfaces and type aliases aren't interchangeable

Both name a shape. They are not the same tool.

```typescript
interface User {
  id: number
  name: string
  email: string
  age?: number // optional property
}

interface Admin extends User {
  permissions: string[]
}
```

`interface` is for object shapes, especially ones another piece of code might extend or add to later. That "add to later" part is not a metaphor — two `interface` declarations with the same name in the same scope merge into one:

```typescript
interface Window {
  myGlobal: string
}
// Elsewhere, maybe in a .d.ts file for a library you don't own:
interface Window {
  anotherGlobal: number
}
// Window now has both properties.
```

This is how you augment a library's ambient types without touching its source, and it's also a footgun if you accidentally declare two unrelated interfaces with the same name — TypeScript won't warn you, it will silently combine them.

`type` cannot do this. A second `type Window = ...` in the same scope is a duplicate-identifier error, which is actually the safer default when you don't want merging:

```typescript
type ID = string | number
type Status = "active" | "inactive" | "pending"
type Point = { x: number; y: number }
```

Reach for `type` for unions, tuples, and primitives — anything an `interface` can't express at all — and default to `interface` for object shapes, specifically because the difference in behavior is invisible until the day someone else's code depends on it.

## Unions, and the null case

A union type says a value is one of several types, and using it safely means checking which one you actually have before you act:

```typescript
function formatId(id: string | number): string {
  if (typeof id === "string") {
    return id.toUpperCase()
  }
  return id.toString()
}
```

Inside the `if`, TypeScript has narrowed `id` to `string`; after it, by elimination, `id` is `number`. That narrowing is a large enough topic to get its own tutorial — see [Type Narrowing in TypeScript](/tutorials/typescript/type-narrowing) once basic unions feel comfortable.

The union you'll write most often is the nullable one:

```typescript
type MaybeUser = User | null

function findUser(id: number): MaybeUser {
  const user = database.get(id)
  return user ?? null
}
```

`??` (nullish coalescing) only falls through on `null` or `undefined`, unlike `||`, which also falls through on `0`, `""`, and `false`. Reach for `??` when you're defaulting a value that might legitimately be falsy but present.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function formatId(id: string | number): string {
    if (___blank_start___typeof___blank_end___ id === "string") {
      return id.toUpperCase()
    }
    return id.toString()
  }
---
::

## A fixed set of values: literal union over enum

`enum` looks like the obvious tool for a fixed set of named values:

```typescript
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

function move(direction: Direction) {
  console.log(`Moving ${direction}`)
}
```

A string literal union does the same job:

```typescript
type Color = "red" | "green" | "blue"

function paint(color: Color) {
  console.log(`Painting ${color}`)
}
```

Default to the literal union. A numeric `enum` (one without string values) generates a reverse mapping at runtime — `Direction[0]` gives you back the member name — which means the compiled object carries twice the keys you wrote, and any value can be looked up in either direction whether you wanted that or not. String enums skip the reverse mapping, but every `enum` still emits an object at runtime, and `const enum` — the variant that doesn't — is rejected by the `erasableSyntaxOnly` flag, which exists to catch code that Node's native `.ts` execution can't handle, because Node only strips type annotations and a `const enum` needs real compilation, not just stripping.

A literal union is erased entirely; it costs nothing at runtime and nothing in your bundle. The only thing you lose is a namespace to hang the values under, which an object with `as const` gives back if you want it:

```typescript
const Direction = { Up: "UP", Down: "DOWN", Left: "LEFT", Right: "RIGHT" } as const
type Direction = (typeof Direction)[keyof typeof Direction]
```

## Typing functions, and the any you don't need

Parameters, optional parameters, defaults, and return types all get annotated the same way:

```typescript
function greetUser(name: string, greeting?: string): string {
  return `${greeting ?? "Hello"}, ${name}!`
}

function createUser(name: string, role: string = "viewer"): User {
  return { id: Date.now(), name, email: "", age: undefined }
}

const multiply = (a: number, b: number): number => a * b

type MathOp = (a: number, b: number) => number
const divide: MathOp = (a, b) => a / b
```

A parameter with a default value is automatically optional, and TypeScript infers its type from the default — `role: string = "viewer"` needs no separate `: string` unless you want to widen it.

What you should not do to make a stubborn parameter type-check is reach for `any`. `any` isn't a type, it's an instruction to stop checking — and that instruction travels through every value it touches:

```typescript
function log(value: any) {
  value.toUpperCase() // no error, even if value is a number
}
```

If you don't know the type yet, `unknown` gives you the same flexibility on the way in and forces a check on the way out — it's the subject of its own tutorial, [Working with unknown safely](/tutorials/typescript/working-with-unknown), once the basics feel comfortable.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function greetUser(name: string, greeting___blank_start___?___blank_end___: string): string {
    return `${greeting ?? "Hello"}, ${name}!`
  }
---
::

## Where this bites

**Annotating everything.** `const age: number = 30` doesn't tell the compiler anything it didn't already know, and it buries the annotations that matter — parameters and public return types — in noise. Annotate what the compiler can't infer, and let the rest infer.

**Reaching for `any` to make an error go away.** It silences the message without fixing the mismatch, and the silence spreads to every value that touches the result afterward. Use `unknown` and narrow, or take the extra minute to find the real type.

**Treating `enum` as the default for a fixed set of values.** A numeric enum's reverse mapping and a `const enum`'s incompatibility with type-stripping tools are both surprises you only discover later. Start with a string literal union, and reach for an object with `as const` if you need a namespace to hang the values under.

**Assuming `interface` and `type` are interchangeable.** They behave alike until someone needs to add a property to your shape from another file — which works for an `interface` and is a compile error for a `type`. Default to `interface` for object shapes specifically because that difference stays invisible until it isn't.
