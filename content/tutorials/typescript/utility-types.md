---
title: "Mastering TypeScript Utility Types"
slug: "typescript-utility-types"
description: "The built-in utility types are ordinary generic aliases you can read and rebuild yourself — knowing which one to reach for beats memorizing the list."
track: "typescript"
order: 5
difficulty: "advanced"
tags: ["utility-types", "mapped-types", "conditional-types", "readonly", "non-nullable"]
practice:
  concept: "generics"
  label: "Generics"
---

A utility type is not special syntax. `Partial<T>`, `Pick<T, K>`, `Record<K, V>` — every one of them is an ordinary generic type alias that ships in the standard library, built from the same mapped and conditional type features available to you. Nothing below is magic; by the end you'll have rebuilt most of it yourself.

## Reshaping and building object types: Partial, Required, Readonly, Pick, Omit, Record

```typescript
interface User {
  id: number
  name: string
  email: string
  avatar?: string
}

type UserUpdate = Partial<User>
// { id?: number; name?: string; email?: string; avatar?: string }

function updateUser(id: number, changes: Partial<User>): User {
  const existing = getUserById(id)
  return { ...existing, ...changes }
}

type CompleteUser = Required<User> // avatar is no longer optional
```

`Readonly<T>` prevents reassignment after construction, which matters for configuration objects and state snapshots:

```typescript
const config: Readonly<AppConfig> = { apiUrl: "https://api.example.com", timeout: 5000, debug: false }
// config.debug = true // Error: Cannot assign to 'debug' because it is a read-only property
```

`Pick` and `Omit` are inverses — one names what to keep, the other names what to drop:

```typescript
interface Article {
  id: number
  title: string
  body: string
  author: string
  createdAt: Date
}

type ArticlePreview = Pick<Article, "id" | "title" | "author">
type CreateArticle = Omit<Article, "id" | "createdAt">
```

`Record<K, V>` builds an object type from a union of keys, and it does something the others don't: it forces every member of `K` to have an entry.

```typescript
type Role = "admin" | "editor" | "viewer"

const rolePermissions: Record<Role, Permissions> = {
  admin: { canRead: true, canWrite: true, canDelete: true },
  editor: { canRead: true, canWrite: true, canDelete: false },
  viewer: { canRead: true, canWrite: false, canDelete: false },
}
```

Delete the `viewer` line and the object literal fails to compile — at the declaration, not at whatever later line first reads `rolePermissions.viewer` and gets `undefined`. That's the real reason to reach for `Record<Role, X>` over `Partial<Record<Role, X>>` or a plain object type: it's a completeness check you get for free, at the earliest possible point.

::code-blank{lang="typescript" href="/tracks/typescript/generics" label="practice generics for real"}
---
code: |
  type ArticlePreview = ___blank_start___Pick___blank_end___<Article, "id" | "title" | "author">
---
::

## Filtering a union: Exclude, Extract, NonNullable

```typescript
type AppEvent = "click" | "scroll" | "mousemove" | "keypress" | "keyup"

type AppKeyboardEvent = Exclude<AppEvent, "click" | "scroll" | "mousemove">
// "keypress" | "keyup"

type AppMouseEvent = Extract<AppEvent, "click" | "scroll" | "mousemove">
// "click" | "scroll" | "mousemove"
```

`Exclude` removes members that match; `Extract` keeps only the ones that do. Both work over any union, not just string literals, which makes `NonNullable<T>` a special case of `Exclude`:

```typescript
type MaybeString = string | null | undefined
type DefiniteString = NonNullable<MaybeString> // string
// same as: Exclude<MaybeString, null | undefined>
```

Note the custom names above — `AppKeyboardEvent` and `AppMouseEvent`, not `KeyboardEvent` and `MouseEvent`. The DOM already owns those names, and shadowing them is a mistake you won't notice until autocomplete starts suggesting the wrong type.

::code-blank{lang="typescript" href="/tracks/typescript/generics" label="practice generics for real"}
---
code: |
  type AppKeyboardEvent = ___blank_start___Exclude___blank_end___<AppEvent, "click" | "scroll" | "mousemove">
---
::

## Pulling types out of functions: Parameters and ReturnType

```typescript
function createUser(name: string, age: number, role: Role) {
  return { id: generateId(), name, age, role, createdAt: new Date() }
}

type NewUser = ReturnType<typeof createUser>
// { id: string; name: string; age: number; role: Role; createdAt: Date }

type CreateUserParams = Parameters<typeof createUser>
// [name: string, age: number, role: Role]
```

The `typeof` here is doing real work — `ReturnType` takes a function *type*, and `createUser` is a value, so `typeof createUser` is what turns it back into the type the function has. This pair earns its keep by keeping a derived type in sync with a function's signature, instead of a parallel interface that drifts the next time someone edits a parameter.

## Mapped and conditional types: what the built-ins actually compile to

```typescript
// How Partial actually works
type MyPartial<T> = {
  [K in keyof T]?: T[K]
}

// Make every property nullable
type Nullable<T> = {
  [K in keyof T]: T[K] | null
}

// Key remapping with `as` — generate a getter name per property
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
}

type ConfigGetters = Getters<{ host: string; port: number }>
// { getHost: () => string; getPort: () => number }
```

`[K in keyof T]` is the whole mechanism — it iterates the keys of `T` and lets you transform the value type, the optionality, or, with an `as` clause, the key name itself. Every built-in that reshapes an object without changing which keys exist is a version of this loop.

Conditional types add branching, and `infer` lets a branch reach into a type and pull a piece back out:

```typescript
type ElementOf<T> = T extends (infer U)[] ? U : never
type Numbers = ElementOf<number[]> // number

type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T
type Result = UnwrapPromise<Promise<Promise<string>>> // string
```

`UnwrapPromise` has to call itself, because a `Promise` can resolve to another `Promise` — the runtime flattens nested promises automatically when you `await` them, so the type has to flatten to match. `Awaited<T>`, built into the standard library, is this exact recursive type, and it's the one you should reach for before writing your own.

::code-blank{lang="typescript" href="/tracks/typescript/generics" label="practice generics for real"}
---
code: |
  type ElementOf<T> = T extends (___blank_start___infer___blank_end___ U)[] ? U : never
---
::

## Where this bites

**`T[K] extends object` matching more than you meant.** A recursive `DeepPartial` written this way also matches arrays and `Date` instances, so `DeepPartial<{ createdAt: Date }>` recurses into `Date`'s internals instead of leaving it alone. Constrain to `Record<string, unknown>` if you specifically mean plain objects.

**Composing three or four utility types on one line instead of naming the intermediate step.** `Readonly<Partial<Pick<Article, "title" | "body" | "author">>>` type-checks and nobody can read it six months from now. Give the composition a name — `type DraftPatch = ...` — even if it's only used once.

**Reaching for `Record<string, X>` when the key set is actually known.** It compiles, but you've traded away the exact benefit `Record` exists to provide — a compile-time check that every case is handled — for a type that accepts any string as a key, typos included.

**Working around `Readonly<T>` with a type assertion.** `(config as { debug: boolean }).debug = true` defeats the read-only check the same way `any` defeats every other check, and it compiles without comment. If a value genuinely needs to change, it shouldn't have been typed `Readonly` in the first place.
