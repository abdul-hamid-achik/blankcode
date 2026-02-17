---
title: "Building Composables"
slug: "vue-composables-guide"
description: "Write reusable composables to extract and share logic across Vue components."
track: "vue"
order: 4
difficulty: "advanced"
tags: ["composables", "composition-api", "reusability", "useAsync", "usePagination", "useLocalStorage", "lifecycle-hooks", "MaybeRefOrGetter", "toValue"]
---

# Building Composables

Composables are the primary pattern for reusing stateful logic in Vue 3. A composable is a function that uses the Composition API to encapsulate reactive state, computed properties, watchers, and lifecycle hooks into a reusable unit.

## What Makes a Composable?

A composable is simply a function whose name starts with `use`. It returns reactive state and functions that components can consume. The key difference from a plain utility function is that composables leverage Vue's reactivity system and can hook into the component lifecycle.

```typescript
import { ref, onMounted, onUnmounted } from 'vue';

// A plain utility — no reactivity, no lifecycle
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// A composable — reactive state, lifecycle awareness
function useWindowSize() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 0);
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 0);

  function update() {
    width.value = window.innerWidth;
    height.value = window.innerHeight;
  }

  onMounted(() => window.addEventListener('resize', update));
  onUnmounted(() => window.removeEventListener('resize', update));

  return { width, height };
}
```

The `typeof window !== 'undefined'` check ensures the composable works in SSR environments where `window` does not exist. Without this guard, the composable would crash during server-side rendering. The initial values fall back to `0`, and `onMounted` only runs in the browser, so the event listener is safe.

## Writing Your First Composable

Let's build a `useMouse` composable that tracks the cursor position:

```typescript
import { ref, onMounted, onUnmounted } from 'vue';

export function useMouse() {
  const x = ref(0);
  const y = ref(0);

  function update(event: MouseEvent) {
    x.value = event.pageX;
    y.value = event.pageY;
  }

  onMounted(() => window.addEventListener('mousemove', update));
  onUnmounted(() => window.removeEventListener('mousemove', update));

  return { x, y };
}
```

Using it in a component is straightforward:

```vue
<script setup lang="ts">
import { useMouse } from '@/composables/useMouse';

const { x, y } = useMouse();
</script>

<template>
  <p>Mouse position: {{ x }}, {{ y }}</p>
</template>
```

Each component that calls `useMouse()` gets its own independent reactive state. The lifecycle hooks bind to the component that calls the composable.

## Async Composable: useAsync

Fetching data is one of the most common tasks. Here is a composable that wraps any async operation with loading, error, and data state:

```typescript
import { ref, type Ref } from 'vue';

interface UseAsyncReturn<T> {
  data: Ref<T | null>;
  error: Ref<string | null>;
  loading: Ref<boolean>;
  execute: () => Promise<void>;
}

export function useAsync<T>(fn: () => Promise<T>): UseAsyncReturn<T> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<string | null>(null);
  const loading = ref(false);

  async function execute() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fn();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  }

  return { data, error, loading, execute };
}
```

**A note on `as Ref<T | null>`:** Vue's `ref<T | null>(null)` infers the type as `Ref<T | null>`, but TypeScript sometimes narrows it to `Ref<null>` when the initial value is `null`. The cast ensures the type stays `Ref<T | null>` so that assigning a `T` value later compiles correctly. This is a known Vue typing quirk.

Usage:

```vue
<script setup lang="ts">
import { useAsync } from '@/composables/useAsync';
import { onMounted } from 'vue';

interface User {
  id: number;
  name: string;
}

const { data: users, loading, error, execute } = useAsync<User[]>(
  () => fetch('/api/users').then(r => r.json()),
);

onMounted(execute);
</script>

<template>
  <div v-if="loading">Loading users...</div>
  <div v-else-if="error">Error: {{ error }}</div>
  <ul v-else-if="users">
    <li v-for="user in users" :key="user.id">{{ user.name }}</li>
  </ul>
</template>
```

## Pagination Composable: usePagination

When working with lists, pagination logic is often repeated. Extract it into a composable that follows its own guidelines — accepting `MaybeRefOrGetter` inputs and using `toValue()`:

```typescript
import { ref, computed, type MaybeRefOrGetter, toValue } from 'vue';

export function usePagination(
  totalItems: MaybeRefOrGetter<number>,
  pageSize: MaybeRefOrGetter<number> = 10,
) {
  const currentPage = ref(1);

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(toValue(totalItems) / toValue(pageSize))),
  );

  const offset = computed(() => (currentPage.value - 1) * toValue(pageSize));

  const hasNext = computed(() => currentPage.value < totalPages.value);
  const hasPrev = computed(() => currentPage.value > 1);

  function next() {
    if (hasNext.value) currentPage.value++;
  }

  function prev() {
    if (hasPrev.value) currentPage.value--;
  }

  function goTo(page: number) {
    currentPage.value = Math.max(1, Math.min(page, totalPages.value));
  }

  return { currentPage, totalPages, offset, hasNext, hasPrev, next, prev, goTo };
}
```

By accepting `MaybeRefOrGetter<number>`, this composable works with plain numbers, refs, or getter functions. `toValue()` unwraps any of these to a plain value inside computeds, so the pagination stays reactive regardless of how the caller passes data.

This composable is stateless with respect to data — it only manages page numbers. The component decides how to fetch or slice the data using `offset` and `pageSize`.

## Local Storage Composable: useLocalStorage

Persisting reactive state to `localStorage` is a common need:

```typescript
import { ref, watch, type Ref } from 'vue';

export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  let initial = defaultValue;

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      try {
        initial = JSON.parse(stored);
      } catch {
        // Stored value is corrupted, fall back to default
        localStorage.removeItem(key);
      }
    }
  }

  const data = ref<T>(initial) as Ref<T>;

  if (typeof window !== 'undefined') {
    watch(
      data,
      (newValue) => {
        localStorage.setItem(key, JSON.stringify(newValue));
      },
      { deep: true },
    );
  }

  return data;
}
```

The `typeof window !== 'undefined'` checks ensure this composable works during SSR. In a server environment, it simply returns a ref with the default value and skips localStorage operations.

Usage:

```vue
<script setup lang="ts">
import { useLocalStorage } from '@/composables/useLocalStorage';

const preferences = useLocalStorage('user-prefs', {
  theme: 'light',
  fontSize: 14,
});

// Changes persist automatically
preferences.value.theme = 'dark';
</script>
```

## Sharing State Between Components

By default, each call to a composable creates independent state. If you want shared (singleton) state, move the reactive declarations outside the function:

```typescript
import { ref, readonly } from 'vue';

const notifications = ref<Array<{ id: number; message: string }>>([]);
let nextId = 0;

export function useNotifications() {
  function add(message: string) {
    notifications.value.push({ id: nextId++, message });
  }

  function dismiss(id: number) {
    notifications.value = notifications.value.filter(n => n.id !== id);
  }

  return {
    notifications: readonly(notifications),
    add,
    dismiss,
  };
}
```

Every component that calls `useNotifications()` shares the same `notifications` array. Use `readonly` to prevent direct mutation from consumers — they must go through the provided functions.

## Lifecycle Hooks Inside Composables

Composables can register lifecycle hooks that bind to the calling component. Always pair setup with teardown:

```typescript
import { onMounted, onUnmounted } from 'vue';

export function useInterval(callback: () => void, ms: number) {
  let id: ReturnType<typeof setInterval>;
  onMounted(() => { id = setInterval(callback, ms); });
  onUnmounted(() => { clearInterval(id); });
}
```

Composables must be called synchronously during setup. Calling one inside an async callback or `setTimeout` will not bind lifecycle hooks correctly.

## Testing Composables

Test composables using `effectScope` to provide a reactive context:

```typescript
import { effectScope } from 'vue';
import { usePagination } from '@/composables/usePagination';

test('usePagination computes pages correctly', () => {
  const scope = effectScope();
  scope.run(() => {
    const { totalPages, currentPage, next } = usePagination(25, 10);
    expect(totalPages.value).toBe(3);
    next();
    expect(currentPage.value).toBe(2);
  });
  scope.stop();
});
```

For composables that use lifecycle hooks, mount a temporary wrapper component with `@vue/test-utils` instead.

## Guidelines for Writing Good Composables

1. **Name with `use` prefix** — `useAuth`, `useFetch`, `useDebounce`. This convention signals reactivity and lifecycle awareness.
2. **Return refs, not raw values** — consumers should get reactive references they can use in templates.
3. **Accept `MaybeRefOrGetter` as input** — use `toValue()` to handle refs, getters, and plain values uniformly. This makes your composable flexible for all callers.
4. **Clean up side effects** — always pair `onMounted` with `onUnmounted` for event listeners, timers, and subscriptions.
5. **Keep composables focused** — one composable should do one thing well. Compose multiple composables together for complex behavior.
6. **Handle SSR** — guard `window`, `document`, and other browser APIs with `typeof window !== 'undefined'` or move them inside `onMounted`.

## Practice

Try the [Vue Composition API exercises](/tracks/vue) to build your own composables in interactive code challenges.
