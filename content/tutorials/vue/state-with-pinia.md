---
title: "State Management with Pinia"
slug: "vue-state-with-pinia"
description: "Master Pinia for managing application state with stores, getters, actions, and plugins."
track: "vue"
order: 3
difficulty: "intermediate"
tags: ["pinia", "state-management", "stores", "getters", "actions", "plugins", "persistence", "storeToRefs"]
---

# State Management with Pinia

Pinia is Vue's official state management library. It replaces Vuex with a simpler, fully typed API that works seamlessly with the Composition API. This tutorial covers everything from creating your first store to advanced patterns like store composition and persistence.

## Why Pinia?

As your application grows, passing props through many component layers becomes unwieldy. Pinia gives you centralized stores that any component can read and write to, with full reactivity and devtools support.

Key advantages over alternatives:
- Full TypeScript support with type inference
- No mutations — just state, getters, and actions
- Works with both Options API and Composition API
- Modular by design — each store is independent
- Devtools integration with time-travel debugging

## Creating a Store

Pinia offers two syntax styles for defining stores. Both are equally capable.

### Option Store

The option store syntax is familiar if you have used Vuex:

```typescript
import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
    lastChanged: null as Date | null,
  }),

  getters: {
    doubled: (state) => state.count * 2,
    isPositive: (state) => state.count > 0,
  },

  actions: {
    increment() {
      this.count++;
      this.lastChanged = new Date();
    },
    decrement() {
      this.count--;
      this.lastChanged = new Date();
    },
    async fetchCount() {
      const res = await fetch('/api/count');
      const data = await res.json();
      this.count = data.count;
    },
  },
});
```

### Setup Store

The setup store syntax mirrors `<script setup>` and gives you maximum flexibility:

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0);
  const lastChanged = ref<Date | null>(null);

  const doubled = computed(() => count.value * 2);
  const isPositive = computed(() => count.value > 0);

  function increment() {
    count.value++;
    lastChanged.value = new Date();
  }

  function decrement() {
    count.value--;
    lastChanged.value = new Date();
  }

  async function fetchCount() {
    const res = await fetch('/api/count');
    const data = await res.json();
    count.value = data.count;
  }

  return { count, lastChanged, doubled, isPositive, increment, decrement, fetchCount };
});
```

Setup stores are recommended for complex logic because you can use any composable inside them.

## Using Stores in Components

Call the store function inside `<script setup>` to get a reactive store instance:

```vue
<script setup lang="ts">
import { useCounterStore } from '@/stores/counter';

const counter = useCounterStore();
</script>

<template>
  <div>
    <p>Count: {{ counter.count }}</p>
    <p>Doubled: {{ counter.doubled }}</p>
    <button @click="counter.increment()">+1</button>
    <button @click="counter.decrement()">-1</button>
  </div>
</template>
```

If you need to destructure, use `storeToRefs` to keep reactivity on state and getters:

```typescript
import { storeToRefs } from 'pinia';

const counter = useCounterStore();
const { count, doubled } = storeToRefs(counter);
// Actions can be destructured directly
const { increment, decrement } = counter;
```

## Subscribing to Changes

Pinia lets you watch for state changes with `$subscribe`:

```typescript
const counter = useCounterStore();

counter.$subscribe((mutation, state) => {
  console.log('State changed:', mutation.type);
  console.log('New count:', state.count);

  // Save to localStorage on every change using the store's ID
  localStorage.setItem(counter.$id, JSON.stringify(state));
});
```

You can also watch specific actions with `$onAction`:

```typescript
counter.$onAction(({ name, args, after, onError }) => {
  const start = Date.now();

  after((result) => {
    console.log(`${name} completed in ${Date.now() - start}ms`);
  });

  onError((error) => {
    console.error(`${name} failed:`, error);
  });
});
```

## Composing Stores

Stores can use other stores. This is the recommended way to share logic between stores:

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './auth';

export const useCartStore = defineStore('cart', () => {
  const auth = useAuthStore();
  const items = ref<Array<{ id: string; name: string; price: number }>>([]);

  const total = computed(() =>
    items.value.reduce((sum, item) => sum + item.price, 0),
  );

  const discountedTotal = computed(() => {
    if (auth.user?.isPremium) {
      return total.value * 0.9;
    }
    return total.value;
  });

  function addItem(item: { id: string; name: string; price: number }) {
    items.value.push(item);
  }

  function removeItem(id: string) {
    items.value = items.value.filter(item => item.id !== id);
  }

  function clear() {
    items.value = [];
  }

  return { items, total, discountedTotal, addItem, removeItem, clear };
});
```

## Persisting State

A common need is persisting store state across page reloads. You can build this with a Pinia plugin:

```typescript
import { type PiniaPluginContext } from 'pinia';

function piniaLocalStorage({ store }: PiniaPluginContext) {
  const saved = localStorage.getItem(store.$id);
  if (saved) {
    try {
      store.$patch(JSON.parse(saved));
    } catch (e) {
      console.error(`Failed to parse stored state for "${store.$id}":`, e);
      localStorage.removeItem(store.$id);
    }
  }

  store.$subscribe((_, state) => {
    localStorage.setItem(store.$id, JSON.stringify(state));
  });
}

// Register the plugin when creating Pinia
import { createPinia } from 'pinia';

const pinia = createPinia();
pinia.use(piniaLocalStorage);
```

Now every store's state automatically saves to and restores from `localStorage`.

For production applications, consider using [`pinia-plugin-persistedstate`](https://prazdevs.github.io/pinia-plugin-persistedstate/) — the standard community plugin for persistence. It handles edge cases like SSR, custom serialization, and selective persistence out of the box:

```typescript
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

// Then in your store:
export const useSettingsStore = defineStore('settings', {
  state: () => ({ theme: 'light', locale: 'en' }),
  persist: true, // that's it
});
```

## Resetting State

Option stores get a built-in `$reset()` method. For setup stores, define your own:

```typescript
export const useFormStore = defineStore('form', () => {
  const name = ref('');
  const email = ref('');

  function $reset() {
    name.value = '';
    email.value = '';
  }

  return { name, email, $reset };
});
```

This is useful for clearing forms, resetting filters, or logging out users.

## What's Next?

Try the [Vue exercises](/tracks/vue) to practice building stores and connecting them to components in interactive challenges.

Next up: [Composables Guide](/tutorials/vue-composables-guide)
