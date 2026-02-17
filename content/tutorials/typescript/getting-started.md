---
title: "Getting Started with TypeScript"
slug: "typescript-getting-started"
description: "Learn TypeScript fundamentals — types, interfaces, and how to think in a typed world."
track: "typescript"
order: 1
difficulty: "beginner"
tags: ["types", "fundamentals", "type-inference", "union-types", "enums", "functions"]
---

# Getting Started with TypeScript

TypeScript extends JavaScript by adding static type definitions. Types provide a way to describe the shape of an object, providing better documentation and allowing TypeScript to validate that your code works correctly.

## Why TypeScript?

TypeScript catches errors at compile time rather than runtime, making your code more robust and easier to maintain. Here are the main benefits:

- **Type Safety** — Catch bugs before they reach production
- **Better Tooling** — Autocompletion, refactoring, and navigation
- **Readability** — Types serve as documentation for your code
- **Scalability** — Easier to maintain large codebases

## Basic Types

TypeScript provides several basic types that you'll use frequently:

```typescript
// Primitive types
const userName: string = "Alice";
const age: number = 30;
const isActive: boolean = true;

// Arrays
const scores: number[] = [95, 87, 92];
const names: Array<string> = ["Alice", "Bob"];

// Tuple — fixed-length array with specific types per position
const pair: [string, number] = ["age", 30];
```

## const vs let

In TypeScript (and modern JavaScript), prefer `const` by default and only use `let` when you need to reassign a variable. This makes your code easier to reason about because you know a `const` binding won't change:

```typescript
const maxRetries = 3;      // cannot be reassigned — use for most values
let currentAttempt = 0;    // needs reassignment — use let

currentAttempt += 1; // OK
// maxRetries = 5;   // Error: Cannot assign to 'maxRetries'
```

Using `const` also narrows the type. A `const` string variable has a literal type rather than the broad `string` type:

```typescript
const direction = "north"; // type: "north" (literal type)
let heading = "north";     // type: string (broad type)
```

## Type Inference

TypeScript is smart enough to infer types from assigned values, so you don't always need explicit annotations. The compiler figures out the type from context:

```typescript
// Explicit annotation — sometimes redundant
const city: string = "Tokyo";

// Inferred — TypeScript knows this is a string
const country = "Japan";

// Inferred — TypeScript knows this is number[]
const numbers = [1, 2, 3];

// Inferred return type — TypeScript knows this returns number
function double(n: number) {
  return n * 2;
}
```

A good rule of thumb: add type annotations to function parameters (TypeScript cannot infer them), but let the compiler infer variable types and return types when the result is obvious. Add explicit return types to public API functions or when the inferred type is complex.

## Interfaces

Interfaces define the structure of objects. They're one of the most powerful features of TypeScript:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number; // optional property
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}

// Extending interfaces
interface Admin extends User {
  permissions: string[];
}

const admin: Admin = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  permissions: ["manage-users", "edit-content"],
};
```

## Type Aliases

Type aliases create a new name for a type. They're similar to interfaces but can represent primitive types, unions, and tuples:

```typescript
type ID = string | number;
type Status = "active" | "inactive" | "pending";

type Point = {
  x: number;
  y: number;
};
```

## Union Types

Union types let a value be one of several types. You use the pipe (`|`) operator to combine types:

```typescript
type Result = string | number;

function formatId(id: string | number): string {
  // Type narrowing — check the type before using it
  if (typeof id === "string") {
    return id.toUpperCase();
  }
  return id.toString();
}

formatId("abc"); // "ABC"
formatId(123);   // "123"
```

Union types are also useful for representing nullable values:

```typescript
type MaybeUser = User | null;

function findUser(id: number): MaybeUser {
  // returns User or null
  const user = database.get(id);
  return user ?? null;
}
```

## Enums

Enums define a set of named constants. They make your code more readable when you have a fixed set of related values:

```typescript
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

function move(direction: Direction) {
  console.log(`Moving ${direction}`);
}

move(Direction.Up); // "Moving UP"
```

For simpler cases, you can use a union of string literals instead:

```typescript
type Color = "red" | "green" | "blue";
```

This is often preferred over enums because it doesn't generate extra JavaScript code at runtime.

## unknown vs any

Both `unknown` and `any` accept any value, but they behave very differently:

```typescript
// any — disables type checking entirely (avoid when possible)
let unsafeValue: any = "hello";
unsafeValue.nonExistentMethod(); // No error — TypeScript gives up

// unknown — safe alternative, forces you to check the type first
let safeValue: unknown = "hello";
// safeValue.toUpperCase();  // Error: Object is of type 'unknown'

if (typeof safeValue === "string") {
  safeValue.toUpperCase(); // OK — type is narrowed to string
}
```

Use `unknown` instead of `any` when you don't know the type ahead of time. It forces you to validate the value before using it, which prevents runtime errors.

## Function Typing

TypeScript lets you type function parameters, return values, optional parameters, and default values:

```typescript
// Basic function with parameter and return types
function add(a: number, b: number): number {
  return a + b;
}

// Optional parameters use ?
function greetUser(name: string, greeting?: string): string {
  return `${greeting ?? "Hello"}, ${name}!`;
}

greetUser("Alice");          // "Hello, Alice!"
greetUser("Alice", "Hey");   // "Hey, Alice!"

// Default values
function createUser(name: string, role: string = "viewer"): User {
  return { id: Date.now(), name, email: "", age: undefined };
}

// Arrow functions
const multiply = (a: number, b: number): number => a * b;

// Function type alias
type MathOp = (a: number, b: number) => number;

const divide: MathOp = (a, b) => a / b;
```

When a parameter has a default value, it's automatically optional and TypeScript infers its type from the default.

## Practice

Now that you understand the basics, put your knowledge to the test with interactive exercises in the [TypeScript track](/tracks/typescript). You'll fill in the blanks to solidify your understanding of each concept.

Next up: [Understanding Generics](/tutorials/typescript-understanding-generics)
