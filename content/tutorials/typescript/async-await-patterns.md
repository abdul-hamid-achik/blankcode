---
title: "Async/Await Patterns in TypeScript"
slug: "typescript-async-await-patterns"
description: "Promises, async/await, and structured error handling — and why Promise.all doesn't cancel the requests it stops waiting for."
track: "typescript"
order: 3
difficulty: "intermediate"
tags: ["async", "promises", "error-handling", "abort-controller"]
practice:
  concept: "async-patterns"
  label: "Async patterns"
---

An `async` function always returns a `Promise`, even when the body returns a plain value — TypeScript wraps it for you, and the return type annotation describes what's inside the `Promise`, not the `Promise` itself. Once that clicks, most of what looks like async-specific syntax is just the type system tracking a value that isn't there yet.

## Promises and async/await

```typescript
interface User {
  id: number
  name: string
  email: string
}

function fetchUser(id: number): Promise<User> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id > 0) {
        resolve({ id, name: "Alice", email: "alice@example.com" })
      } else {
        reject(new Error("Invalid user ID"))
      }
    }, 1000)
  })
}

fetchUser(1)
  .then((user) => console.log(user.name))
  .catch((err) => console.error(err.message))
```

`await` is that same `.then()` chain written so it reads top to bottom:

```typescript
async function getUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch user`)
  }
  const data: User = await response.json()
  return data
}
```

Marking a function `async` does two things: every `await` inside it pauses until the awaited value resolves, and every `return` gets wrapped in a `Promise`, however many layers deep the returned value already was. Return a `Promise<string>` from an `async` function and the caller still gets `Promise<string>`, not `Promise<Promise<string>>` — the runtime flattens nested promises when it resolves one, and the built-in `Awaited<T>` type exists specifically because that flattening can happen more than once.

## Errors: try/catch, and what the caught value's type is

```typescript
interface Post {
  id: number
  title: string
  body: string
}

interface UserWithPosts extends User {
  posts: Post[]
}

async function loadUserProfile(id: number): Promise<UserWithPosts | null> {
  try {
    const user = await getUser(id)
    const posts = await fetchPosts(user.id)
    return { ...user, posts }
  } catch (error) {
    if (error instanceof TypeError) {
      console.error("Network error:", error.message)
    } else if (error instanceof Error) {
      console.error("Failed to load profile:", error.message)
    }
    return null
  }
}
```

Inside a `catch`, `error` is typed `unknown` by default under `strict` — the same type as everything else that crosses a boundary TypeScript didn't see the other side of. `instanceof` narrows it the normal way; `fetch` itself throws `TypeError` on a network failure before a response ever exists, which is why that check comes first here, separate from the `response.ok` check for an HTTP error that did get a response.

::code-blank{lang="typescript" href="/tracks/typescript/async-patterns" label="practice async patterns for real"}
---
code: |
  async function loadUserProfile(id: number): Promise<UserWithPosts | null> {
    try {
      const user = await getUser(id)
      const posts = await fetchPosts(user.id)
      return { ...user, posts }
    } ___blank_start___catch___blank_end___ (error) {
      return null
    }
  }
---
::

## Running promises together: all, allSettled, race

```typescript
// Sequential — each request waits for the previous one to finish
async function loadDashboardSlow(userId: number): Promise<DashboardData> {
  const user = await getUser(userId)
  const posts = await fetchPosts(userId)
  const notifications = await fetchNotifications(userId)
  return { user, posts, notifications }
}

// Parallel — every request fires immediately
async function loadDashboard(userId: number): Promise<DashboardData> {
  const [user, posts, notifications] = await Promise.all([
    getUser(userId),
    fetchPosts(userId),
    fetchNotifications(userId),
  ])
  return { user, posts, notifications }
}
```

`Promise.all` is correct here because the three requests don't depend on each other — nothing about fetching posts needs the user to have already loaded. It rejects as soon as any one promise rejects, which is a real cost worth knowing: the other requests are not cancelled, they keep running to completion in the background, unobserved, because a `Promise` has no way to signal a running operation to stop on its own.

When partial success is acceptable, `allSettled` waits for every promise regardless of outcome:

```typescript
async function fetchAllUsers(ids: number[]) {
  const results = await Promise.allSettled(ids.map((id) => getUser(id)))
  const users: User[] = []
  const errors: string[] = []
  for (const result of results) {
    if (result.status === "fulfilled") {
      users.push(result.value)
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
    }
  }
  return { users, errors }
}
```

`Promise.race` settles as soon as the first promise does, win or lose — the standard shape for a timeout:

```typescript
function fetchWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms)
  )
  return Promise.race([promise, timeout])
}
```

::code-blank{lang="typescript" href="/tracks/typescript/async-patterns" label="practice async patterns for real"}
---
code: |
  async function loadDashboard(userId: number): Promise<DashboardData> {
    const [user, posts, notifications] = await Promise.___blank_start___all___blank_end___([
      getUser(userId),
      fetchPosts(userId),
      fetchNotifications(userId),
    ])
    return { user, posts, notifications }
  }
---
::

## Cancellation with AbortController

```typescript
async function fetchWithCancel(url: string, signal: AbortSignal): Promise<User> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

const controller = new AbortController()
const userPromise = fetchWithCancel("/api/users/1", controller.signal)

controller.abort() // e.g. the user navigated away

try {
  const user = await userPromise
} catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    console.log("Request was cancelled")
  } else {
    throw error
  }
}
```

This is the actual answer to the problem the previous section left open — `AbortController` gives a running operation a way to be told to stop, which a bare `Promise` cannot do on its own. Pass the same `signal` to more than one `fetch` call and one `abort()` cancels all of them, which is the pattern behind a search box: abort the previous request the moment a new keystroke fires another one.

::code-blank{lang="typescript" href="/tracks/typescript/async-patterns" label="practice async patterns for real"}
---
code: |
  async function fetchWithCancel(url: string, signal: AbortSignal): Promise<User> {
    const response = await fetch(url, { ___blank_start___signal___blank_end___ })
    return response.json()
  }
---
::

## Where this bites

**Assuming `Promise.all` cancels the losing requests.** It stops *waiting* on the first rejection, but every other promise keeps running until it settles on its own — if one of them has a side effect, that side effect still happens. Use `AbortController` if you actually need the others to stop.

**Forgetting the `await`.** `const result = saveToDatabase(user)` returns the `Promise` itself, not the value it resolves to, so `console.log(result)` prints `Promise { <pending> }` instead of the data. TypeScript catches some of these — passing a `Promise<T>` where `T` is expected — but not a bare, unused expression statement.

**Awaiting inside a loop when the calls don't depend on each other.** `for (const item of items) { await processItem(item) }` processes one at a time even though nothing stops them running together; `await Promise.all(items.map((item) => processItem(item)))` does the same work concurrently.

**An empty `catch` block.** `catch { }` swallows the error completely — no log, no rethrow, nothing — turning a real failure into a silent no-op that looks, from the outside, exactly like success. Catch specifically what you can handle, and let everything else propagate.
