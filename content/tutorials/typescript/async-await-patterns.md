---
title: "Async/Await Patterns in TypeScript"
slug: "typescript-async-await-patterns"
description: "Write clean asynchronous code with Promises, async/await, and proper error handling in TypeScript."
track: "typescript"
order: 3
difficulty: "intermediate"
tags: ["async", "promises", "error-handling", "abort-controller"]
---

# Async/Await Patterns in TypeScript

Asynchronous programming is at the heart of modern TypeScript applications. Whether you're fetching data from an API, reading files, or querying a database, you need to handle operations that complete in the future. TypeScript's type system makes async code safer by ensuring you handle Promise types correctly.

## Promises Basics

A Promise represents a value that may not be available yet. It can be in one of three states: pending, fulfilled, or rejected.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function fetchUser(id: number): Promise<User> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id > 0) {
        resolve({ id, name: "Alice", email: "alice@example.com" });
      } else {
        reject(new Error("Invalid user ID"));
      }
    }, 1000);
  });
}

// Consuming a Promise with .then()
fetchUser(1)
  .then((user) => console.log(user.name))
  .catch((err) => console.error(err.message));
```

TypeScript infers that `user` is of type `User` inside the `.then()` callback, giving you full autocompletion and type checking.

## Async/Await Syntax

The `async`/`await` syntax is syntactic sugar over Promises that makes asynchronous code read like synchronous code:

```typescript
async function getUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch user`);
  }

  // Note: response.json() returns Promise<any> by default.
  // In production code, validate the response at runtime (e.g., with Zod)
  // to ensure the data matches the expected shape.
  const data: User = await response.json();
  return data;
}
```

Any function marked `async` automatically returns a `Promise`. TypeScript enforces that the return type annotation matches the resolved value wrapped in `Promise<T>`.

## Error Handling with Try/Catch

Always wrap `await` calls in `try`/`catch` blocks when errors are possible:

```typescript
interface Post {
  id: number;
  title: string;
  body: string;
}

interface UserWithPosts extends User {
  posts: Post[];
}

async function loadUserProfile(id: number): Promise<UserWithPosts | null> {
  try {
    const user = await getUser(id);
    const posts = await fetchPosts(user.id);
    return { ...user, posts };
  } catch (error) {
    if (error instanceof TypeError) {
      console.error("Network error:", error.message);
    } else if (error instanceof Error) {
      console.error("Failed to load profile:", error.message);
    }
    return null;
  }
}
```

Notice how TypeScript narrows the `error` type inside each `instanceof` check. In a `catch` block, `error` is typed as `unknown` by default, so you must narrow it before accessing properties.

## Typing Async Functions

TypeScript offers several ways to type your async code precisely:

```typescript
// Explicit return type
async function fetchItems(): Promise<string[]> {
  const res = await fetch("/api/items");
  return res.json();
}

// Arrow function with async
const fetchCount = async (): Promise<number> => {
  const res = await fetch("/api/count");
  const data = await res.json();
  return data.count;
};

// The built-in Awaited<T> type (available since TypeScript 4.5)
// unwraps Promise types, including nested ones.
type UserResult = Awaited<ReturnType<typeof getUser>>; // User
type NestedResult = Awaited<Promise<Promise<string>>>;  // string

// For educational purposes, here is how you could implement it yourself:
// type MyAwaited<T> = T extends Promise<infer U> ? MyAwaited<U> : T;
```

## Parallel Execution with Promise.all

When you have multiple independent async operations, run them in parallel instead of sequentially:

```typescript
interface Notification {
  id: number;
  message: string;
}

interface DashboardData {
  user: User;
  posts: Post[];
  notifications: Notification[];
}

// Sequential — slow, each waits for the previous one
async function loadDashboardSlow(userId: number): Promise<DashboardData> {
  const user = await getUser(userId);
  const posts = await fetchPosts(userId);
  const notifications = await fetchNotifications(userId);
  return { user, posts, notifications };
}

// Parallel — fast, all requests fire at once
async function loadDashboard(userId: number): Promise<DashboardData> {
  const [user, posts, notifications] = await Promise.all([
    getUser(userId),
    fetchPosts(userId),
    fetchNotifications(userId),
  ]);
  return { user, posts, notifications };
}
```

`Promise.all` rejects immediately if any promise rejects. Use it when you need all results and any failure should abort the operation.

## Promise.allSettled and Promise.race

When you need more control over how multiple promises resolve, use `allSettled` or `race`:

```typescript
// allSettled — wait for everything, never rejects
async function fetchAllUsers(ids: number[]) {
  const results = await Promise.allSettled(
    ids.map((id) => getUser(id))
  );

  const users: User[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      users.push(result.value);
    } else {
      // result.reason is unknown — check before accessing .message
      const reason = result.reason;
      errors.push(
        reason instanceof Error ? reason.message : String(reason)
      );
    }
  }

  return { users, errors };
}

// race — first to settle wins
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms)
  );

  return Promise.race([promise, timeout]);
}

const user = await fetchWithTimeout(getUser(1), 5000);
```

`Promise.allSettled` is ideal when partial success is acceptable. `Promise.race` is useful for timeouts and fallback patterns.

## Cancellation with AbortController

When you need to cancel in-flight requests — for example, when a user navigates away or types a new search query — use `AbortController`:

```typescript
async function fetchWithCancel(
  url: string,
  signal: AbortSignal
): Promise<User> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// Usage
const controller = new AbortController();

// Start the request
const userPromise = fetchWithCancel("/api/users/1", controller.signal);

// Cancel it if needed (e.g., user navigates away)
controller.abort();

// The fetch will reject with an AbortError
try {
  const user = await userPromise;
} catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    console.log("Request was cancelled");
  } else {
    throw error; // re-throw unexpected errors
  }
}
```

`AbortController` is the standard mechanism for cooperative cancellation. Pass the `signal` to `fetch` or any other API that supports it.

## Common Pitfalls

There are a few mistakes that trip up even experienced developers:

```typescript
// Pitfall 1: Forgetting to await
async function saveUser(user: User) {
  // Bug: this returns a Promise, not the result
  const result = saveToDatabase(user);
  console.log(result); // Promise { <pending> }

  // Fix: always await async calls
  const saved = await saveToDatabase(user);
  console.log(saved);
}

// Pitfall 2: Sequential awaits in a loop
async function processItems(items: string[]) {
  // Slow: processes one at a time
  for (const item of items) {
    await processItem(item);
  }

  // Fast: processes all in parallel
  await Promise.all(items.map((item) => processItem(item)));
}

// Pitfall 3: Swallowing errors with empty catch
async function riskyOperation() {
  try {
    await dangerousAction();
  } catch {
    // Bad: error is silently ignored
  }
}
```

## Practice

Ready to write async TypeScript with confidence? Head to the [TypeScript track](/tracks/typescript) to practice async patterns with interactive fill-in-the-blank exercises.

Next up: [Type Narrowing](/tutorials/typescript-type-narrowing)
