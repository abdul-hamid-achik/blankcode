---
title: "Understanding TypeScript Generics"
slug: "typescript-understanding-generics"
description: "How a type parameter differs from any, what a constraint actually promises, and when to let inference pick the type instead of writing it yourself."
track: "typescript"
order: 2
difficulty: "intermediate"
tags: ["generics", "type-safety", "reusability", "constraints", "keyof"]
practice:
  concept: "generics"
  label: "Generics"
---

A generic is not `any` with extra steps. `any` throws the type away; a generic captures it, so whatever comes in on one side of a function is provably the same thing that comes out the other side. That relationship — input type equals output type — is the entire feature. Everything below is a different way of describing, constraining, or defaulting that relationship.

## The type any throws away

Without a type parameter, you write one function per type, or give up and write one function for every type:

```typescript
function getFirstNumber(arr: number[]): number {
  return arr[0]
}

function getFirstAny(arr: any[]): any {
  return arr[0]
}
```

The first doesn't generalize. The second generalizes by deleting the information — call `getFirstAny(["a", "b"])` and the result is typed `any`, which means nothing downstream is checked, ever again.

A generic function keeps the relationship instead of deleting it:

```typescript
function getFirst<T>(arr: T[]): T | undefined {
  return arr[0]
}

const num = getFirst([1, 2, 3])        // number | undefined
const str = getFirst(["a", "b", "c"])  // string | undefined
```

`T` is decided at the call site, not at the definition — TypeScript looks at what you passed in and works out what `T` must be. You almost never write `getFirst<number>([1, 2, 3])` yourself; the array's element type is enough for the compiler to infer it. Write the explicit type argument only when there's nothing to infer from, like an empty array literal where you want a specific element type rather than `never`.

::code-blank{lang="typescript" href="/tracks/typescript/generics" label="practice generics for real"}
---
code: |
  function getFirst<___blank_start___T___blank_end___>(arr: T[]): T | undefined {
    return arr[0]
  }
---
::

## Constraints narrow what's safe, not what T is

`T extends HasLength` reads like an assignment and isn't one. It's a bound: `T` can be any type that satisfies the constraint, and it stays exactly the type the caller passed — not the constraint type.

```typescript
interface HasLength {
  length: number
}

function logLength<T extends HasLength>(value: T): T {
  console.log(value.length)
  return value
}

const s = logLength("hello")   // T is "hello", not HasLength
const a = logLength([1, 2, 3]) // T is number[], not HasLength
```

If `T` really did collapse to `HasLength` inside the function, the return type would be `HasLength` too, and `logLength("hello")` would come back as some object with a `length` property instead of the literal string type it actually is. The constraint only filters what's allowed in; it doesn't touch what the compiler remembers about what you gave it.

The most common constraint pairs a type parameter with `keyof` of another one, so a key argument can only be a key that actually exists:

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user = { id: 1, name: "Alice", email: "alice@example.com" }

const name = getProperty(user, "name") // string
// getProperty(user, "age")            // Error: "age" is not in keyof T
```

`K extends keyof T` and a return type of `T[K]` together are what make `getProperty` impossible to call with a key that doesn't exist, and what make its return type exactly the type of that property — not `unknown`, not a union of every property type on the object.

::code-blank{lang="typescript" href="/tracks/typescript/generics" label="practice generics for real"}
---
code: |
  function getProperty<T, K extends ___blank_start___keyof___blank_end___ T>(obj: T, key: K): T[K] {
    return obj[key]
  }
---
::

## Generic interfaces and classes carry the parameter through the whole shape

A function has one input and one output to relate. A type can relate a whole structure:

```typescript
interface ApiResponse<T> {
  data: T
  status: number
  message: string
}

type UserResponse = ApiResponse<User>
type PostResponse = ApiResponse<Post[]>
```

Every field that mentions `T` stays locked to whatever `T` is for that particular response — `UserResponse["data"]` is `User`, not some generic placeholder.

Classes work the same way, and it's the natural fit for anything that holds values without caring what they are:

```typescript
class Stack<T> {
  private items: T[] = []

  push(item: T): void {
    this.items.push(item)
  }

  pop(): T | undefined {
    return this.items.pop()
  }
}

const numbers = new Stack<number>()
numbers.push(1)
const top = numbers.pop() // number | undefined
```

`<number>` on `new Stack<number>()` is doing real work here, because there's nothing yet to infer it from — the class has no arguments that would reveal `T`. Same rule as before, restated: write the type argument only when the compiler has no other way to find it.

## Defaults, and picking a type argument you didn't have to

A generic parameter can have a default, the same way a function parameter can:

```typescript
interface Container<T = string> {
  value: T
  label: string
}

const textBox: Container = { value: "hello", label: "Name" } // T defaults to string
const numberBox: Container<number> = { value: 42, label: "Age" }
```

Reach for a default when one type is clearly the common case and the rest are the exception — it lets most call sites drop the `<...>` entirely, while the ones that need something else still can.

The broader habit worth taking from all of this: prefer letting TypeScript infer `T` from an argument over writing `<T>` yourself. An explicit type argument is a claim you're making to the compiler, not a fact it derived — if it disagrees with what you passed, you get an error at the call site instead of a silently wrong inference, but you also lose the thing generics are for, which is the compiler doing the bookkeeping.

::code-blank{lang="typescript" href="/tracks/typescript/generics" label="practice generics for real"}
---
code: |
  interface Container<T = ___blank_start___string___blank_end___> {
    value: T
    label: string
  }
---
::

## Where this bites

**Writing `<T>` on an arrow function inside a `.tsx` file.** The parser reads `<T>(x: T) => x` as the start of a JSX tag and fails; write `<T,>(x: T) => x` — the trailing comma disambiguates — or add a constraint, `<T extends unknown>(x: T) => x`.

**Passing an explicit type argument that fights inference.** `getFirst<string>([1, 2, 3])` doesn't convert the numbers to strings — it tells the compiler to expect `string`, and the numbers fail to match, producing an error far from where the real mistake is. Let inference run first, and override it only when you have a specific reason.

**Reaching for a type parameter when a union would do.** A function that only ever needs to accept `string | number` doesn't need `<T>` — a union says exactly what's allowed, while a bare `T` claims to work for literally anything, a promise the function body usually can't keep.

**Using `any` inside a generic function to work around a variance error.** It compiles, but it reintroduces the exact hole the generic exists to close, just one level deeper where it's harder to find. If the compiler is rejecting an assignment inside the function body, that's usually a sign the constraint is missing something, not a reason to stop checking.
