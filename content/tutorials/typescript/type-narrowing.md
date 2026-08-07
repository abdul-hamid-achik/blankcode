---
title: "Type Narrowing in TypeScript"
slug: "typescript-type-narrowing"
description: "How typeof, instanceof, in, discriminated unions, and assertion functions each narrow a type, and why narrowing can silently evaporate across a function call."
track: "typescript"
order: 4
difficulty: "intermediate"
tags: ["type-guards", "narrowing", "discriminated-unions", "assertion-functions"]
practice:
  concept: "basics"
  label: "TypeScript basics"
---

TypeScript's type system is flow-sensitive: it re-evaluates a value's type at every line, based on what the code between the declaration and that line proves. Check a value's type with `typeof`, `instanceof`, or a property test, and everything after that check — inside the branch where it's true — gets the narrower type for free, with no cast required.

## typeof guards

```typescript
function format(value: string | number): string {
  if (typeof value === "string") {
    return value.toUpperCase()
  }
  return value.toFixed(2)
}

function processInput(input: string | number | boolean) {
  if (typeof input === "string") {
    console.log("String length:", input.length)
  } else if (typeof input === "number") {
    console.log("Doubled:", input * 2)
  } else {
    console.log("Negated:", !input) // narrowed to boolean by elimination
  }
}
```

TypeScript recognizes `typeof` checks for `"string"`, `"number"`, `"boolean"`, `"symbol"`, `"bigint"`, `"undefined"`, `"object"`, and `"function"` — nothing else narrows this way, because those are the only eight strings `typeof` can ever return.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function format(value: string | number): string {
    if (___blank_start___typeof___blank_end___ value === "string") {
      return value.toUpperCase()
    }
    return value.toFixed(2)
  }
---
::

## instanceof and the in operator

```typescript
class ApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
  }
}

class ValidationError extends Error {
  constructor(message: string, public fields: string[]) {
    super(message)
  }
}

function handleError(error: Error) {
  if (error instanceof ApiError) {
    console.log(`API error ${error.statusCode}: ${error.message}`)
  } else if (error instanceof ValidationError) {
    console.log(`Invalid fields: ${error.fields.join(", ")}`)
  } else {
    console.log("Unknown error:", error.message)
  }
}
```

`instanceof` narrows on the prototype chain, so it only works for classes — not for plain object shapes distinguished by which properties they carry. That's what the `in` operator is for:

```typescript
interface Fish {
  swim: () => void
}

interface Bird {
  fly: () => void
}

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim() // narrowed to Fish
  } else {
    animal.fly() // narrowed to Bird
  }
}
```

`in` narrows on whether the *type* says a property exists, not on whether the *value* actually has it at runtime. That's a safe assumption for values you constructed yourself, and a risky one for anything that crossed a real boundary — a parsed response, `localStorage`, a message from a worker — where the type is a claim nobody checked.

## Custom type guards, and where narrowing stops following you

```typescript
interface Car {
  type: "car"
  doors: number
}

interface Truck {
  type: "truck"
  payload: number
}

type Vehicle = Car | Truck

function isCar(vehicle: Vehicle): vehicle is Car {
  return vehicle.type === "car"
}

function describeVehicle(vehicle: Vehicle) {
  if (isCar(vehicle)) {
    console.log(`Car with ${vehicle.doors} doors`)
  } else {
    console.log(`Truck with ${vehicle.payload}kg payload`)
  }
}
```

The `vehicle is Car` return type is what makes this work. Without it, `isCar` would return a plain `boolean`, and the branch inside `describeVehicle` would not narrow at all.

Narrowing tracks a specific expression, not a value in the abstract, and that distinction matters most with a property access instead of a local variable:

```typescript
function process(state: { data: string | null }) {
  if (state.data !== null) {
    doSomethingElse() // any function call...
    state.data.trim() // ...and TypeScript re-widens state.data to string | null here
  }
}
```

TypeScript can't prove `doSomethingElse` didn't reassign `state.data` in between — it has no way to know the function's body doesn't reach back into `state` — so it discards the narrowing on `state.data` at the call and re-checks the full union afterward. A local variable doesn't have this problem, because nothing outside the current scope can reassign it:

```typescript
function process(state: { data: string | null }) {
  const { data } = state
  if (data !== null) {
    doSomethingElse()
    data.trim() // still string — a local const can't be reassigned by another function
  }
}
```

Destructure into a local before narrowing anything you plan to use after a function call.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function isCar(vehicle: Vehicle): vehicle ___blank_start___is___blank_end___ Car {
    return vehicle.type === "car"
  }
---
::

## Discriminated unions and exhaustive checking

```typescript
interface LoadingState {
  status: "loading"
}

interface SuccessState {
  status: "success"
  data: string[]
}

interface ErrorState {
  status: "error"
  message: string
}

type RequestState = LoadingState | SuccessState | ErrorState

function renderState(state: RequestState): string {
  switch (state.status) {
    case "loading":
      return "Loading..."
    case "success":
      return `Found ${state.data.length} items`
    case "error":
      return `Error: ${state.message}`
  }
}
```

The discriminant — `status` here — has to be a literal type shared by every member, not just a field with the same name. Type it as the widened `string` instead of the specific literals, and the `switch` keeps compiling but stops narrowing anything; every case body still sees the full union.

Add `never` to the mix and a missing case becomes a compile error instead of a silent gap:

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2
    case "rectangle":
      return shape.width * shape.height
    default: {
      const _exhaustive: never = shape
      return _exhaustive
    }
  }
}
```

Add `{ kind: "triangle"; ... }` to `Shape` and forget to handle it, and `shape` in the `default` branch is no longer assignable to `never` — the build fails at the exact line that needs a new case, instead of eventually, at whatever line calls `.base` on a shape that doesn't have one.

::code-blank{lang="typescript" href="/tracks/typescript/basics" label="practice typescript basics for real"}
---
code: |
  function area(shape: Shape): number {
    switch (shape.kind) {
      case "circle":
        return Math.PI * shape.radius ** 2
      default: {
        const _exhaustive: ___blank_start___never___blank_end___ = shape
        return _exhaustive
      }
    }
  }
---
::

## Assertion functions

```typescript
function assertDefined<T>(value: T | null | undefined, name: string): asserts value is T {
  if (value == null) {
    throw new Error(`${name} must be defined`)
  }
}

function loadUser(id: number) {
  const user = findUserById(id)
  assertDefined(user, "User")
  console.log(user.name) // narrowed to non-null for the rest of the function
}
```

An assertion function narrows differently from a type guard: instead of narrowing one branch, it narrows everything after the call, for the rest of the enclosing scope, because the only way past it is for the condition to hold — the unhappy path throws instead of returning `false`. Reach for one when a bad value means the function truly cannot continue, not as a shorter way to write an `if`.

## Where this bites

**Narrowing a property access across an intervening function call.** `if (state.data !== null)` followed by a call to anything before you use `state.data` again throws the narrowing away, because the compiler can't rule out the call reassigning it. Destructure into a local `const` first, and narrow that instead.

**Trusting `in` on data that crossed a real boundary.** The operator narrows on what the type declares, not on what the value actually has, so a parsed response typed with an optional field can pass `"key" in value` while the key is genuinely `undefined`. Validate untrusted data before you narrow it, not after.

**Typing a discriminant as `string` instead of a literal union.** The switch still compiles and looks identical in the editor, but nothing narrows — every case body sees the full union, and the bug shows up as a type error three functions downstream instead of here. Whatever field you switch on needs a literal type on every member, usually via `as const` if it comes from an object literal.

**Reaching for `!` where you meant a check.** The non-null assertion doesn't run anything at runtime — it just tells the compiler to stop complaining — so it removes the type error without removing the possibility that the value really is `null`. Use a real narrowing check or an assertion function when you want the mistake to throw instead of crash somewhere else.
