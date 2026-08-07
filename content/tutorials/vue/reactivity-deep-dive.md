---
title: "Vue Reactivity Deep Dive"
slug: "vue-reactivity-deep-dive"
description: "How Proxy-based dependency tracking actually decides what to re-run, why ref beats reactive as the default, and the synchronous-tracking rule that breaks watchEffect after an await."
track: "vue"
order: 2
difficulty: "intermediate"
tags: ["reactivity", "ref", "reactive", "computed", "watch", "watchEffect", "shallowRef", "shallowReactive", "toRefs", "toRef", "proxy"]
practice:
  concept: "composition-api"
  label: "Composition API"
---

Vue's reactivity is not magic — it's a `Proxy` around your data plus a stack that tracks which function is currently running. Understanding the mechanism, not just the API, is what tells you why some perfectly reasonable-looking code silently stops updating.

## Dependency tracking: what a read actually does

Every reactive value — a `ref`'s `.value`, a property on a `reactive()` object — is backed by a `get` trap. When Vue runs a render function, a `computed` getter, or a `watchEffect` callback, it pushes that function onto an internal stack as the "active effect." Any reactive property read while that function is on the stack gets one line added to its dependency list: wake this effect when I change. A `set` trap on the same property later walks that list and re-runs exactly those effects — nothing else. That is the entire trick: which effects re-run is determined by what was actually read, not by which template happens to mention a variable.

The rule has a sharp edge: tracking only happens for reads that occur synchronously, before the function yields control. Inside `watchEffect`, everything read before the first `await` is tracked; everything read after it is invisible to Vue, because by the time the microtask resumes, the effect has already been popped off the stack.

```typescript
const status = ref('idle')
const query = ref('')

// BROKEN — status is read after an await, so changing it later
// never re-runs this effect
watchEffect(async () => {
  const q = query.value // tracked — read before the await
  await fetch(`/api/search?q=${q}`)
  console.log(status.value) // NOT tracked
})
```

Fix it by reading everything reactive up front, or by switching to `watch` with explicit sources, which builds its dependency list once and does not re-derive it from execution order at all.

## ref vs reactive: why ref is the default

`ref` wraps any value — primitive or object — in a small box with a `.value` property, and that box is what carries the `get`/`set` traps. Because the box itself is what is reactive, not the value inside it, passing a ref into a function, returning it from a composable, or storing it in an array all preserve tracking; only unwrapping it with `.value` loses the connection, and you do that explicitly.

```typescript
const count = ref(0)
count.value++
```

`reactive()` instead proxies the object directly, so the tracking lives on the object's own properties rather than on a box you carry around. Destructure a property out of a `reactive()` object and you get a plain value at that instant — the proxy that would have tracked further reads is gone, because you are no longer going through it. `toRefs()` fixes this by wrapping each property in its own ref-shaped box before you destructure, so the tracking travels with each variable instead of staying behind on the object.

```typescript
const state = reactive({ count: 0 })

const { count } = state // plain number, frozen at this instant
const { count: tracked } = toRefs(state) // ref, still connected
```

This is also why `reactive()` cannot hold a primitive on its own and cannot be reassigned wholesale — `state = reactive({ count: 5 })` builds a brand-new proxy that nothing else is pointing at. `ref` has neither limitation, which is the real argument for defaulting to it: one API that behaves the same way for every value type, with no destructuring trap waiting for a caller who doesn't know the object came from `reactive()`.

::code-blank{lang="typescript" href="/tracks/vue/composition-api" label="practice composition api for real"}
---
code: |
  // The general-purpose reactive primitive — works for any value type
  const count = ___blank_start___ref___blank_end___(0)
---
::

## computed: cached, and only as fresh as its dependencies

A `computed` re-evaluates only when a dependency it read last time has changed — call `.value` on it a hundred times between changes and the getter runs once. That laziness is also why the getter must stay pure: put a side effect (pushing to an array, calling an API) inside a computed getter and it runs whenever Vue decides the cache is stale, which is not the same as whenever you would want a side effect to fire. Use `watch` for side effects and keep `computed` a pure derivation.

```typescript
const firstName = ref('Ada')
const lastName = ref('Lovelace')

const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (value: string) => {
    const [first, ...rest] = value.split(' ')
    firstName.value = first
    lastName.value = rest.join(' ')
  },
})
```

::code-blank{lang="typescript" href="/tracks/vue/composition-api" label="practice composition api for real"}
---
code: |
  // Cached — the getter only re-runs when items or filter changes
  const filtered = ___blank_start___computed___blank_end___(() => items.value.filter((i) => i.active))
---
::

## shallowRef and shallowReactive: opting out on purpose

Deep reactivity means Vue recursively wraps every nested object the first time it's touched, at a cost proportional to the size of the structure. For a large value you replace wholesale — an API response, a big dataset — that cost buys you nothing, because nothing ever mutates a nested field in place.

```typescript
const rows = shallowRef<Row[]>([])

rows.value = await fetchRows() // tracked — reassigning .value
rows.value[0].name = 'edited' // NOT tracked — nested mutation

// Force a re-render after a nested mutation without a full reassignment:
triggerRef(rows)
```

`shallowReactive` applies the same idea to an object's own properties: top-level assignment is tracked, anything nested is not.

::code-blank{lang="typescript" href="/tracks/vue/composition-api" label="practice composition api for real"}
---
code: |
  // Only .value reassignment is tracked, not nested mutations
  const rows = ___blank_start___shallowRef___blank_end___<Row[]>([])
---
::

## Where this bites

**Reading a value after an `await` inside `watchEffect`.** Anything read past the first suspension point never joins the dependency list, so the effect silently stops reacting to it while everything read before the `await` still works — the bug looks intermittent because half the function is reactive and half isn't. Read what you need up front, or switch to `watch` with an explicit source list.

**Destructuring a `reactive()` object.** `const { user } = state` compiles, runs, and returns a value that looks correct in a debugger — it simply never updates again, because the destructure severed the connection to the proxy. Use `toRefs(state)` before destructuring, or don't destructure `reactive()` state at all.

**Reassigning a whole `reactive()` object.** `state = reactive({ ...newData })` replaces the variable's proxy, but every template and computed that captured the original `state` reference is still watching the old one. Mutate the existing object's properties instead, or use `ref` for anything you intend to swap wholesale.

**Mutating nested data on a `shallowRef` and expecting a re-render.** The shallow variants only track the `.value` assignment itself, so `rows.value[0].name = 'x'` changes the data in memory with no UI update and no error. Either reassign `.value` to a new array or object, or call `triggerRef()` right after the mutation.
