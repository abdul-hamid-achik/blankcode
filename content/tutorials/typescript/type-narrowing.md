---
title: "Type Narrowing in TypeScript"
slug: "typescript-type-narrowing"
description: "Use type guards, discriminated unions, and assertion functions to narrow types safely."
track: "typescript"
order: 4
difficulty: "intermediate"
tags: ["type-guards", "narrowing", "discriminated-unions", "assertion-functions"]
---

# Type Narrowing in TypeScript

TypeScript's type system is structural and flow-sensitive. When you write code that checks the shape or type of a value, TypeScript narrows the type within that branch. This means you can start with a broad type like `string | number` and refine it to a specific type without any unsafe casts.

## typeof Guards

The `typeof` operator is the simplest way to narrow primitive types:

```typescript
function format(value: string | number): string {
  if (typeof value === "string") {
    // TypeScript knows value is string here
    return value.toUpperCase();
  }
  // TypeScript knows value is number here
  return value.toFixed(2);
}

function processInput(input: string | number | boolean) {
  if (typeof input === "string") {
    console.log("String length:", input.length);
  } else if (typeof input === "number") {
    console.log("Doubled:", input * 2);
  } else {
    // TypeScript narrows to boolean
    console.log("Negated:", !input);
  }
}
```

TypeScript recognizes `typeof` checks for `"string"`, `"number"`, `"boolean"`, `"symbol"`, `"bigint"`, `"undefined"`, `"object"`, and `"function"`.

## instanceof Narrowing

Use `instanceof` to narrow class instances:

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public fields: string[]
  ) {
    super(message);
  }
}

function handleError(error: Error) {
  if (error instanceof ApiError) {
    // TypeScript knows error has statusCode
    console.log(`API error ${error.statusCode}: ${error.message}`);
  } else if (error instanceof ValidationError) {
    // TypeScript knows error has fields
    console.log(`Invalid fields: ${error.fields.join(", ")}`);
  } else {
    console.log("Unknown error:", error.message);
  }
}
```

## The `in` Operator

The `in` operator checks whether a property exists on an object, which TypeScript uses to narrow union types:

```typescript
interface Fish {
  swim: () => void;
}

interface Bird {
  fly: () => void;
}

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    // TypeScript knows animal is Fish
    animal.swim();
  } else {
    // TypeScript knows animal is Bird
    animal.fly();
  }
}
```

This works well when union members have distinct properties but don't share a common discriminant field.

## Custom Type Guards

For complex narrowing logic, write custom type guard functions using the `is` keyword:

```typescript
interface Car {
  type: "car";
  doors: number;
}

interface Truck {
  type: "truck";
  payload: number;
}

type Vehicle = Car | Truck;

// Custom type guard
function isCar(vehicle: Vehicle): vehicle is Car {
  return vehicle.type === "car";
}

function describeVehicle(vehicle: Vehicle) {
  if (isCar(vehicle)) {
    console.log(`Car with ${vehicle.doors} doors`);
  } else {
    console.log(`Truck with ${vehicle.payload}kg payload`);
  }
}
```

Type guard functions return a boolean, but the `vehicle is Car` return type tells TypeScript to narrow the type in the truthy branch. Use these when the narrowing logic is reusable or too complex for an inline check.

```typescript
// Narrowing nullable types
// Note: the loose equality (!=) is intentional here —
// `value != null` checks for both null and undefined in one expression.
function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

const items: (string | null)[] = ["a", null, "b", null, "c"];
const filtered: string[] = items.filter(isNonNull);
```

## Discriminated Unions

Discriminated unions are the most powerful narrowing pattern in TypeScript. Each member of the union has a common literal property (the discriminant) that TypeScript uses to determine the specific type:

```typescript
interface LoadingState {
  status: "loading";
}

interface SuccessState {
  status: "success";
  data: string[];
}

interface ErrorState {
  status: "error";
  message: string;
}

type RequestState = LoadingState | SuccessState | ErrorState;

function renderState(state: RequestState): string {
  switch (state.status) {
    case "loading":
      return "Loading...";
    case "success":
      // TypeScript knows state has data
      return `Found ${state.data.length} items`;
    case "error":
      // TypeScript knows state has message
      return `Error: ${state.message}`;
  }
}
```

This pattern is especially useful for state machines, API responses, and event handling.

## Exhaustive Checking with never

The `never` type ensures you handle every case in a discriminated union. If you miss one, TypeScript raises a compile error:

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
    case "triangle":
      return (shape.base * shape.height) / 2;
    default: {
      // If you add a new shape and forget a case,
      // TypeScript will error here
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}
```

If you later add `{ kind: "pentagon"; ... }` to `Shape` but forget to handle it in the switch, `shape` won't be assignable to `never` and TypeScript will flag the problem at compile time.

## Assertion Functions

Assertion functions narrow types by throwing if the condition is false. They use the `asserts` keyword:

```typescript
function assertDefined<T>(
  value: T | null | undefined,
  name: string
): asserts value is T {
  if (value == null) {
    throw new Error(`${name} must be defined`);
  }
}

function loadUser(id: number) {
  const user = findUserById(id);
  assertDefined(user, "User");
  // TypeScript knows user is not null/undefined
  console.log(user.name);
}
```

Unlike type guard functions that return a boolean, assertion functions throw on the unhappy path. The narrowing applies to all code after the assertion call.

## Practice

Type narrowing is one of TypeScript's most practical features. Once you're comfortable with these patterns, you'll write fewer type assertions and produce safer code. Practice these techniques with hands-on exercises in the [TypeScript track](/tracks/typescript).

Next up: [Utility Types](/tutorials/typescript-utility-types)
