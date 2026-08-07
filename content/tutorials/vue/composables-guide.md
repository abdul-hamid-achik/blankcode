---
title: "Building Composables"
slug: "vue-composables-guide"
description: "When a function actually earns the use prefix, the MaybeRefOrGetter/toValue contract that makes one reusable, and why calling a composable after an await silently breaks its lifecycle hooks."
track: "vue"
order: 4
difficulty: "advanced"
tags: ["composables", "composition-api", "reusability", "useAsync", "usePagination", "useLocalStorage", "lifecycle-hooks", "MaybeRefOrGetter", "toValue"]
practice:
  concept: "composition-api"
  label: "Composition API"
---

A composable is a function that uses `ref`, `watch`, or a lifecycle hook to encapsulate reactive behavior — not just any function whose name starts with `use`. The distinction matters because it decides where the code should live and how it gets tested.

## What earns a composable, and what's just a function

`formatCurrency(amount)` doesn't touch reactivity or the component lifecycle — it's a pure utility, and wrapping it in a composable adds nothing but an unnecessary import path and a misleading name. A composable earns the name when it holds reactive state across calls, registers a lifecycle hook, or coordinates enough moving parts — loading/error/data, cleanup, retries — that pulling it out of the component makes the component's own logic easier to read.

```typescript
// A composable — owns reactive state and a lifecycle hook
function useMouse() {
  const x = ref(0)
  const y = ref(0)

  function update(e: MouseEvent) {
    x.value = e.pageX
    y.value = e.pageY
  }

  onMounted(() => window.addEventListener('mousemove', update))
  onUnmounted(() => window.removeEventListener('mousemove', update))

  return { x, y }
}
```

Every call to `useMouse()` gets its own `x` and `y` — the lifecycle hooks bind to whichever component instance happens to be active when the function runs, and that detail is what the rest of this tutorial is about.

::code-blank{lang="typescript" href="/tracks/vue/composition-api" label="practice composition api for real"}
---
code: |
  // Owns independent x/y state and lifecycle hooks per call
  function useMouse() {
    const x = ___blank_start___ref___blank_end___(0)
    const y = ref(0)
    return { x, y }
  }
---
::

## Why "call it synchronously" is a real rule, not a style guideline

Vue tracks which component is currently being set up with a single module-level pointer, set right before your `setup()` (or `<script setup>`) body runs and cleared right after it finishes. `onMounted`, `onUnmounted`, and every other lifecycle hook just read that pointer and attach themselves to whatever it currently points at. Call a composable — and therefore its lifecycle hooks — while that pointer is set, and everything binds correctly. Call it one microtask later, after an `await`, inside a `setTimeout`, or inside an event handler, and the pointer has already been cleared; the hook call becomes a no-op, with a warning in development and nothing at all in production.

```typescript
async function setup() {
  await loadConfig()
  useMouse() // BROKEN — setup's synchronous window has already closed
}
```

The fix is never to make the composable smarter — it's to call it before the first `await`, and let it start its own async work internally if it needs to.

## State ownership: one instance per call, or one shared instance

By default a composable's state is private to each call — every component invoking `useMouse()` gets independent `x`/`y` refs. Move the `ref` declarations outside the function, to module scope, and every caller shares the same state instead:

```typescript
const notifications = ref<Notification[]>([])
let nextId = 0

export function useNotifications() {
  function add(message: string) {
    notifications.value.push({ id: nextId++, message })
  }
  return { notifications: readonly(notifications), add }
}
```

Reach for the shared-singleton shape only for things that are genuinely one thing app-wide — a toast queue, a websocket connection. The moment several unrelated parts of the app need to both read and write that state, and it needs to survive far outside where it was created, it has outgrown a composable and belongs in a Pinia store instead, which gives it a name, a devtools panel, and an explicit reset.

## The MaybeRefOrGetter contract

A composable that only accepts plain numbers forces every caller to unwrap their own refs first. Accepting `MaybeRefOrGetter<T>` and reading through `toValue()` removes that tax — the composable works identically whether the caller passes a number, a `ref`, or a getter function, because `toValue()` normalizes all three to a plain value at the point of use.

```typescript
function usePagination(
  total: MaybeRefOrGetter<number>,
  pageSize: MaybeRefOrGetter<number> = 10,
) {
  const page = ref(1)
  const totalPages = computed(() =>
    Math.ceil(toValue(total) / toValue(pageSize)),
  )
  return { page, totalPages }
}
```

::code-blank{lang="typescript" href="/tracks/vue/composition-api" label="practice composition api for real"}
---
code: |
  // Normalizes a number, a ref, or a getter to a plain value at read time
  const pages = computed(() => Math.ceil(___blank_start___toValue___blank_end___(total) / pageSize))
---
::

## Testing without mounting a component

A composable with no lifecycle hooks can be tested inside an `effectScope`, which gives `ref`/`computed`/`watch` a reactive context to run in without a real component:

```typescript
const scope = effectScope()
scope.run(() => {
  const { page, totalPages } = usePagination(25, 10)
  expect(totalPages.value).toBe(3)
})
scope.stop()
```

A composable that registers `onMounted`/`onUnmounted` needs an actual component instance for those hooks to bind to — mount a throwaway wrapper with `@vue/test-utils` instead of trying to force it through `effectScope`.

## Where this bites

**Calling a composable after an `await` or inside a callback.** Its lifecycle hooks silently become no-ops because the active-instance pointer they read has already been cleared — the composable "works" in that nothing throws, it just never cleans up. Call every composable synchronously, unconditionally, at the top of setup.

**Wrapping a pure function in a composable for consistency.** A function with no `ref`, `watch`, or lifecycle hook doesn't need Vue's reactivity system at all, and giving it a `use` prefix implies guarantees — SSR safety, cleanup, reactive returns — it doesn't actually provide. Put pure logic in `utils/` and reserve `use*` for functions that touch reactivity.

**Returning a raw `reactive()` object instead of refs.** Callers naturally destructure a composable's return value, and destructuring a `reactive()` object throws away tracking at exactly the boundary the composable was supposed to make safe. Return individual refs, or return a plain object of refs and computeds — never a `reactive()` object meant to be destructured.

**Using module-scope singleton state for something that isn't shared.** Every caller of that composable now mutates the same underlying ref, so two unrelated components using what looks like "their own" paginator end up stepping on each other's page number. Keep state declarations inside the function body unless sharing it is the explicit point.
