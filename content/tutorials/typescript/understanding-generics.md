---
title: "Understanding TypeScript Generics"
slug: "typescript-understanding-generics"
description: "Master generics to write flexible, reusable, and type-safe code."
track: "typescript"
order: 2
difficulty: "intermediate"
tags: ["generics", "type-safety", "reusability", "constraints", "keyof"]
---

# Understanding TypeScript Generics

Generics allow you to write components that work with any data type while still maintaining full type safety. Instead of using `any`, generics let you capture the type the user provides.

## The Problem

Without generics, you'd have to write specific functions for each type or resort to `any`:

```typescript
// Too specific
function getFirstNumber(arr: number[]): number {
  return arr[0];
}

// Too loose — we lose type information
function getFirstAny(arr: any[]): any {
  return arr[0];
}
```

## Generic Functions

Generics solve this by letting you parameterize types:

```typescript
function getFirst<T>(arr: T[]): T | undefined {
  return arr[0];
}

const num = getFirst([1, 2, 3]);       // type: number | undefined
const str = getFirst(["a", "b", "c"]); // type: string | undefined
const empty = getFirst([]);             // type: undefined
```

The return type is `T | undefined` because calling `getFirst` on an empty array returns `undefined`. This makes the type honest about what actually happens at runtime.

## Multiple Type Parameters

Generics can accept more than one type parameter. Use this when your function relates two or more types:

```typescript
function makePair<A, B>(first: A, second: B): [A, B] {
  return [first, second];
}

const pair = makePair("hello", 42); // type: [string, number]

function mapObject<K extends string, V, R>(
  obj: Record<K, V>,
  fn: (value: V) => R
): Record<K, R> {
  const result = {} as Record<K, R>;
  for (const key in obj) {
    result[key] = fn(obj[key]);
  }
  return result;
}

const lengths = mapObject({ a: "hello", b: "world" }, (s) => s.length);
// type: Record<"a" | "b", number>
```

## Generic Constraints

You can constrain generics to ensure they have certain properties:

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(value: T): void {
  console.log(value.length);
}

logLength("hello");     // OK — strings have length
logLength([1, 2, 3]);   // OK — arrays have length
// logLength(42);       // Error — numbers don't have length
```

## The keyof Constraint Pattern

A very common and powerful pattern is constraining one type parameter based on another using `keyof`:

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

interface User {
  id: number;
  name: string;
  email: string;
}

const user: User = { id: 1, name: "Alice", email: "alice@example.com" };

const name = getProperty(user, "name");  // type: string
const id = getProperty(user, "id");      // type: number
// getProperty(user, "age");             // Error: "age" is not in keyof User
```

This pattern guarantees at compile time that you can only access keys that actually exist on the object, and the return type matches the property type.

## Generic Interfaces

Interfaces can be generic too, which is common for data structures and API responses:

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

interface User {
  id: number;
  name: string;
}

interface Post {
  id: number;
  title: string;
  body: string;
}

type UserResponse = ApiResponse<User>;
type PostResponse = ApiResponse<Post[]>;
```

## Generic Classes

Classes can also be generic. This is especially useful for collection types and data structures:

```typescript
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  get size(): number {
    return this.items.length;
  }
}

const numberStack = new Stack<number>();
numberStack.push(1);
numberStack.push(2);
const top = numberStack.pop(); // type: number | undefined

const stringStack = new Stack<string>();
stringStack.push("hello");
```

## Generic Defaults

You can provide default types for generic parameters, similar to default function arguments:

```typescript
interface Container<T = string> {
  value: T;
  label: string;
}

// Uses the default type (string)
const textBox: Container = { value: "hello", label: "Name" };

// Overrides the default
const numberBox: Container<number> = { value: 42, label: "Age" };
```

Defaults are useful for types that are most commonly used with a specific type but need to be flexible.

## Practice

Generics are one of TypeScript's most powerful features. Once you're comfortable with type parameters, constraints, and defaults, you can write code that is both flexible and fully type-safe. Try the [Generics exercises](/tracks/typescript) in the TypeScript track.

Next up: [Async/Await Patterns](/tutorials/typescript-async-await-patterns)
