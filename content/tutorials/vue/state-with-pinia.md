---
title: "State Management with Pinia"
slug: "vue-state-with-pinia"
description: "What actually belongs in a Pinia store instead of component state, why setup stores are the better default, and the reactivity trap that storeToRefs exists specifically to avoid."
track: "vue"
order: 3
difficulty: "intermediate"
tags: ["pinia", "state-management", "stores", "getters", "actions", "plugins", "persistence", "storeToRefs"]
practice:
  concept: "pinia"
  label: "Pinia"
---

Pinia stores are reactive objects that live for the lifetime of the app rather than the lifetime of one component. That single fact is the whole design question this tutorial is about: deciding what belongs in one, and handling it correctly once it's there.

## What belongs in a store

A component's own `ref` is the default, not the exception. State moves into a store only when at least one of these is true: two or more unrelated components need to read or write it, it has to survive the component that created it being unmounted, or a route change shouldn't reset it. A single form's draft input, a dropdown's open/closed flag, a modal's local step counter — none of that qualifies. Putting it in a store anyway doesn't just add indirection; it means that state now lives for the app's entire session unless someone remembers to reset it, a cost paid by whoever debugs the stale value months later.

## Setup stores as the default

Pinia offers two syntaxes. The option store — `state`/`getters`/`actions` as a plain object — mirrors Vuex and is fine for a simple, static shape. The setup store mirrors `<script setup>` itself: `ref` for state, `computed` for getters, plain functions for actions. It's the better default the moment a store needs anything beyond a flat object — composing another store, calling a composable, an early return during setup, or a piece of state that genuinely needs a `Map` or `Set` rather than a plain property.

```typescript
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const total = computed(() =>
    items.value.reduce((sum, item) => sum + item.price, 0),
  )

  function addItem(item: CartItem) {
    items.value.push(item)
  }

  return { items, total, addItem }
})
```

::code-blank{lang="typescript" href="/tracks/vue/pinia" label="practice pinia for real"}
---
code: |
  // Setup store — state as ref, getters as computed, actions as functions
  const items = ___blank_start___ref___blank_end___<CartItem[]>([])
---
::

## storeToRefs: why destructuring a store needs it

A store instance is itself a reactive object under the hood — calling `useCartStore()` hands you something built the same way `reactive()` builds its proxy. Destructuring state or getters straight off it hits the same wall as destructuring any other `reactive()` object: `const { total } = useCartStore()` reads `total` once and gives you a frozen number, not a tracked value, and the template using it stops updating the moment the store changes.

```typescript
import { storeToRefs } from 'pinia'

const cart = useCartStore()
const { items, total } = storeToRefs(cart) // refs — stay connected
const { addItem } = cart // plain function — safe to destructure directly
```

`storeToRefs` walks the store and wraps every piece of state and every getter in its own ref, and deliberately skips anything that's a function. Actions don't need that treatment — a function reference doesn't go stale the way a snapshotted value does, so destructuring `addItem` directly works fine while destructuring `total` directly does not.

::code-blank{lang="typescript" href="/tracks/vue/pinia" label="practice pinia for real"}
---
code: |
  // Keeps state and getters reactive after destructuring a store
  const { items, total } = ___blank_start___storeToRefs___blank_end___(cart)
---
::

## Composing stores

Stores can call other stores from inside their own setup function — this is the supported way to share logic between them, not a workaround:

```typescript
export const useCartStore = defineStore('cart', () => {
  const auth = useAuthStore()
  const items = ref<CartItem[]>([])

  const total = computed(() =>
    auth.user?.isPremium
      ? items.value.reduce((s, i) => s + i.price, 0) * 0.9
      : items.value.reduce((s, i) => s + i.price, 0),
  )

  return { items, total }
})
```

That call has to happen inside `useCartStore`'s own setup function, not at module scope when the file loads — Pinia's active-instance context isn't established at import time, the same synchronous-call rule that governs lifecycle hooks elsewhere in the Composition API.

## Subscribing to changes and persistence

`$subscribe` runs after every state mutation and is the low-level hook persistence is built on:

```typescript
cart.$subscribe((mutation, state) => {
  localStorage.setItem(cart.$id, JSON.stringify(state))
})
```

For production, reach for [`pinia-plugin-persistedstate`](https://prazdevs.github.io/pinia-plugin-persistedstate/) instead of hand-rolling this — it already handles SSR, selective persistence, and custom serialization:

```typescript
export const useSettingsStore = defineStore('settings', {
  state: () => ({ theme: 'light' }),
  persist: true,
})
```

::code-blank{lang="typescript" href="/tracks/vue/pinia" label="practice pinia for real"}
---
code: |
  // Runs after every mutation — the hook persistence plugins build on
  cart.___blank_start___$subscribe___blank_end___((mutation, state) => saveState(state))
---
::

## Where this bites

**Destructuring state or a getter straight off a store.** `const { total } = useCartStore()` compiles and returns the right value once, then never updates again, while the store itself keeps changing correctly in devtools. Always route state and getters through `storeToRefs`; destructure actions directly.

**Defaulting every piece of component state into a store.** A store outlives the component that touched it, so a scratch value nobody explicitly resets — a search draft, a wizard step — quietly carries over the next time the user visits that page. If only one component tree needs it, keep it a local `ref`.

**Expecting `$reset()` on a setup store.** Option stores get a free `$reset()` that restores the initial `state()` object; setup stores don't, because Pinia has no way to know which of your refs count as "state" to reset. Define your own `$reset` function and return it if the store needs one.

**Calling another store at module scope instead of inside `defineStore`'s setup function.** `const auth = useAuthStore()` written at the top of a file, outside any store definition, runs before Pinia's app context exists and throws or returns a broken instance. Call it inside the setup function body — the same rule that governs lifecycle hooks anywhere else in the Composition API.
