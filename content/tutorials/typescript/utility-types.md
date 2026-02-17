---
title: "Mastering TypeScript Utility Types"
slug: "typescript-utility-types"
description: "Learn built-in utility types and build your own with mapped and conditional types."
track: "typescript"
order: 5
difficulty: "advanced"
tags: ["utility-types", "mapped-types", "conditional-types", "readonly", "non-nullable"]
---

# Mastering TypeScript Utility Types

TypeScript ships with a collection of utility types that transform existing types into new ones. These types are essential for writing DRY, expressive type definitions. Beyond the built-ins, you can construct your own utility types using mapped types and conditional types, unlocking the full power of TypeScript's type system.

## Partial and Required

`Partial<T>` makes all properties optional. `Required<T>` does the opposite, making all properties required:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

// All properties become optional
type UserUpdate = Partial<User>;
// { id?: number; name?: string; email?: string; avatar?: string }

function updateUser(id: number, changes: Partial<User>): User {
  const existing = getUserById(id);
  return { ...existing, ...changes };
}

updateUser(1, { name: "Alice" }); // only update name

// All properties become required, even avatar
type CompleteUser = Required<User>;
// { id: number; name: string; email: string; avatar: string }
```

## Readonly

`Readonly<T>` makes all properties read-only, preventing reassignment after creation:

```typescript
interface AppConfig {
  apiUrl: string;
  timeout: number;
  debug: boolean;
}

const config: Readonly<AppConfig> = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
  debug: false,
};

// config.debug = true; // Error: Cannot assign to 'debug' because it is a read-only property
```

This is useful for configuration objects, state snapshots, or any data that should not be mutated after initialization.

## Pick and Omit

`Pick<T, K>` creates a type with only the specified properties. `Omit<T, K>` creates a type with all properties except the specified ones:

```typescript
interface Article {
  id: number;
  title: string;
  body: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

// Only keep what the list view needs
type ArticlePreview = Pick<Article, "id" | "title" | "author">;
// { id: number; title: string; author: string }

// Remove auto-generated fields for creation
type CreateArticle = Omit<Article, "id" | "createdAt" | "updatedAt">;
// { title: string; body: string; author: string }

function createArticle(data: CreateArticle): Article {
  return {
    ...data,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

These two types are inverses of each other: `Pick` specifies what to keep, `Omit` specifies what to remove.

## Record

`Record<K, V>` creates an object type with keys of type `K` and values of type `V`:

```typescript
type Role = "admin" | "editor" | "viewer";

interface Permissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

const rolePermissions: Record<Role, Permissions> = {
  admin: { canRead: true, canWrite: true, canDelete: true },
  editor: { canRead: true, canWrite: true, canDelete: false },
  viewer: { canRead: true, canWrite: false, canDelete: false },
};
```

`Record` enforces that every key in the union has an entry. Forgetting `"viewer"` above would cause a compile error.

## NonNullable

`NonNullable<T>` removes `null` and `undefined` from a union type:

```typescript
type MaybeString = string | null | undefined;
type DefiniteString = NonNullable<MaybeString>; // string

function processValue(value: string | null | undefined) {
  // value could be null or undefined here
  const safe: NonNullable<typeof value> = value!;
  // Only use ! when you've already validated — prefer narrowing instead
}

// More practical: use with mapped types to strip nullability from all fields
type StrictUser = {
  [K in keyof User]: NonNullable<User[K]>;
};
```

## Exclude and Extract

`Exclude<T, U>` removes members from a union type. `Extract<T, U>` keeps only the matching members:

```typescript
type AppEvent = "click" | "scroll" | "mousemove" | "keypress" | "keyup";

type AppKeyboardEvent = Exclude<AppEvent, "click" | "scroll" | "mousemove">;
// "keypress" | "keyup"

type AppMouseEvent = Extract<AppEvent, "click" | "scroll" | "mousemove">;
// "click" | "scroll" | "mousemove"
```

Note that we use custom names `AppKeyboardEvent` and `AppMouseEvent` to avoid shadowing the built-in DOM types `KeyboardEvent` and `MouseEvent`.

## ReturnType and Parameters

These types extract information from function signatures:

```typescript
function createUser(name: string, age: number, role: Role) {
  return { id: generateId(), name, age, role, createdAt: new Date() };
}

// Extract the return type
type NewUser = ReturnType<typeof createUser>;
// { id: string; name: string; age: number; role: Role; createdAt: Date }

// Extract the parameter types as a tuple
type CreateUserParams = Parameters<typeof createUser>;
// [name: string, age: number, role: Role]

// Use with index access for individual params
type FirstParam = Parameters<typeof createUser>[0]; // string
```

These are especially useful when you want to keep types in sync with a function without declaring a separate interface.

## Building Custom Utility Types with Mapped Types

Mapped types iterate over keys of a type and transform each property. This is how `Partial`, `Required`, and `Readonly` work under the hood:

```typescript
// How Partial works internally
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};

// Make all properties nullable
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

interface Config {
  host: string;
  port: number;
  debug: boolean;
}

type NullableConfig = Nullable<Config>;
// { host: string | null; port: number | null; debug: boolean | null }

// Create getters for all properties
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type ConfigGetters = Getters<Config>;
// { getHost: () => string; getPort: () => number; getDebug: () => boolean }
```

The `as` clause in mapped types (key remapping) lets you transform property names, enabling patterns like prefixed getters, event handlers, or API method maps.

## Conditional Types with infer

Conditional types follow the pattern `T extends U ? X : Y`. Combined with `infer`, they can extract types from complex structures:

```typescript
// Extract the element type from an array
type ElementOf<T> = T extends (infer U)[] ? U : never;

type Numbers = ElementOf<number[]>; // number
type Strings = ElementOf<string[]>; // string

// Unwrap a Promise (one level)
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type Result = UnwrapPromise<Promise<string>>; // string
type Plain = UnwrapPromise<number>;           // number

// Extract props from a component-like function
type PropsOf<T> = T extends (props: infer P) => any ? P : never;

function Button(props: { label: string; onClick: () => void }) {
  return props;
}

type ButtonProps = PropsOf<typeof Button>;
// { label: string; onClick: () => void }
```

## Combining Utility Types

Real-world type definitions often combine multiple utility types:

```typescript
interface DatabaseRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Post extends DatabaseRecord {
  title: string;
  body: string;
  published: boolean;
  authorId: string;
}

// For creating: omit auto-generated fields
type CreatePost = Omit<Post, keyof DatabaseRecord>;
// { title: string; body: string; published: boolean; authorId: string }

// For updating: omit auto-generated fields, make everything optional
type UpdatePost = Partial<Omit<Post, keyof DatabaseRecord>>;
// { title?: string; body?: string; published?: boolean; authorId?: string }

// For API response: readonly to signal immutability
type PostResponse = Readonly<Post>;

// For list views: pick only summary fields
type PostSummary = Pick<Post, "id" | "title" | "published" | "createdAt">;
```

This pattern of composing utility types keeps your type definitions concise, consistent, and automatically in sync with the source interface.

You can also build recursive utility types by combining mapped and conditional types:

```typescript
// Make all nested properties optional (deep partial).
// Note: `T[K] extends object` matches arrays and Dates too.
// For stricter behavior, use `T[K] extends Record<string, unknown>`.
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

interface AppConfig {
  server: {
    host: string;
    port: number;
  };
  features: {
    darkMode: boolean;
    notifications: boolean;
  };
}

// Now you can override only the parts you care about
function mergeConfig(
  defaults: AppConfig,
  overrides: DeepPartial<AppConfig>
): AppConfig {
  return deepMerge(defaults, overrides);
}

mergeConfig(defaults, { server: { port: 8080 } });
```

## Practice

Utility types are the building blocks of advanced TypeScript. The key is knowing which tool to reach for and how to combine them. Practice building and composing utility types with exercises in the [TypeScript track](/tracks/typescript).
