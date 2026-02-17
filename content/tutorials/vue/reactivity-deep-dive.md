---
title: "Vue Reactivity Deep Dive"
slug: "vue-reactivity-deep-dive"
description: "Understand how Vue's reactivity system works under the hood with ref, reactive, computed, and watchers."
track: "vue"
order: 2
difficulty: "intermediate"
tags: ["reactivity", "ref", "reactive", "computed", "watch", "watchEffect", "shallowRef", "shallowReactive", "toRefs", "toRef", "proxy"]
---

# Vue Reactivity Deep Dive

Vue's reactivity system is what makes your UI automatically update when data changes. Understanding how it works helps you write better, more efficient components.

## How Vue Reactivity Works

Vue 3's reactivity is built on JavaScript's `Proxy` object. When you create reactive state with `ref` or `reactive`, Vue wraps your data in a Proxy that intercepts property access (`get`) and modification (`set`). During a component's render (or inside a `computed`/`watchEffect`), Vue tracks which reactive properties are read — this is called **dependency tracking**. When a tracked property changes, Vue knows exactly which effects (renders, computeds, watchers) depend on it and re-runs only those. This fine-grained tracking is what makes Vue efficient — it never re-renders more than necessary.

## ref vs reactive

Vue 3's Composition API provides two ways to create reactive state: `ref` and `reactive`.

### ref — The Recommended Default

`ref` is the general-purpose, recommended choice for reactive state. It works with any value type — primitives, objects, arrays, or anything else:

```vue
<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
const name = ref('Alice');
const user = ref({ name: 'Alice', age: 30 });

// Access/modify with .value in script
count.value++;
console.log(count.value); // 1

// Objects work just as well
user.value.name = 'Bob';
</script>

<template>
  <!-- In template, .value is automatically unwrapped -->
  <span>{{ count }}</span>
  <span>{{ user.name }}</span>
</template>
```

`ref` is recommended because it works consistently regardless of value type, can be reassigned freely, and maintains reactivity when passed to functions or destructured.

### reactive — A Niche Alternative

`reactive` creates a reactive proxy around an object. It has no `.value` wrapper, which can feel cleaner for object state, but comes with important limitations:

```typescript
import { reactive } from 'vue';

const state = reactive({
  count: 0,
  user: { name: 'Alice' },
});

// No .value needed
state.count++;
state.user.name = 'Bob';
```

**Caveats of `reactive`:**

1. **Only works with objects** — not primitives like strings or numbers.
2. **Destructuring breaks reactivity:**

```typescript
// BAD — loses reactivity
const { count } = state;

// GOOD — use toRefs or toRef
import { toRefs, toRef } from 'vue';
const { count } = toRefs(state);
const singleRef = toRef(state, 'count');
```

3. **Reassigning the whole object breaks reactivity:**

```typescript
// BAD — the component still points to the old proxy
state = reactive({ count: 5, user: { name: 'Charlie' } });

// GOOD — mutate properties instead
state.count = 5;
state.user = { name: 'Charlie' };

// Or use ref for the whole object and reassign .value
const state2 = ref({ count: 0 });
state2.value = { count: 5 }; // works fine
```

Use `toRef` (singular) to create a ref linked to a single property, and `toRefs` to convert all properties at once. Both maintain the reactive connection to the original object.

## shallowRef and shallowReactive

By default, `ref` and `reactive` deeply convert nested objects into reactive proxies. When you have large data structures where you only need top-level reactivity, use the shallow variants for better performance:

```typescript
import { shallowRef, shallowReactive, triggerRef } from 'vue';

// Only .value assignment is tracked — nested mutations are NOT reactive
const largeList = shallowRef([{ id: 1, name: 'Alice' }]);

// This will NOT trigger updates:
largeList.value[0].name = 'Bob';

// This WILL trigger updates (replacing .value):
largeList.value = [...largeList.value];

// Or manually trigger reactivity after mutation:
largeList.value[0].name = 'Bob';
triggerRef(largeList);

// shallowReactive — only top-level properties are reactive
const state = shallowReactive({
  count: 0,              // reactive
  nested: { deep: true } // NOT reactive
});

state.count++;          // triggers updates
state.nested.deep = false; // does NOT trigger updates
state.nested = { deep: false }; // triggers updates (top-level assignment)
```

`shallowRef` is especially useful for large arrays, external library objects, or data from APIs where you replace the whole value rather than mutating nested properties.

## computed

Computed properties automatically track their dependencies and only re-evaluate when those dependencies change.

### Read-only computed

```typescript
import { ref, computed } from 'vue';

const items = ref([1, 2, 3, 4, 5]);
const filter = ref('even');

const filteredItems = computed(() => {
  if (filter.value === 'even') {
    return items.value.filter(n => n % 2 === 0);
  }
  return items.value.filter(n => n % 2 !== 0);
});
```

### Writable computed

Sometimes you need a computed that can also be set. Use the getter/setter form:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';

const firstName = ref('Alice');
const lastName = ref('Smith');

const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (newValue: string) => {
    const [first, ...rest] = newValue.split(' ');
    firstName.value = first;
    lastName.value = rest.join(' ');
  },
});

// Reading works as usual
console.log(fullName.value); // 'Alice Smith'

// Setting splits the value back into parts
fullName.value = 'Bob Jones';
// firstName.value === 'Bob', lastName.value === 'Jones'
</script>

<template>
  <input v-model="fullName" />
  <p>First: {{ firstName }}, Last: {{ lastName }}</p>
</template>
```

Writable computeds are useful for v-model bindings where the display format differs from the stored format.

## watchEffect vs watch

Both let you run side effects when reactive state changes.

### watchEffect

`watchEffect` runs immediately and automatically tracks every reactive dependency accessed during execution:

```vue
<script setup lang="ts">
import { ref, watchEffect } from 'vue';

const query = ref('');
const results = ref<string[]>([]);

// Runs immediately, then re-runs whenever query.value changes
watchEffect(async () => {
  if (query.value.length < 2) {
    results.value = [];
    return;
  }
  const response = await fetch(`/api/search?q=${encodeURIComponent(query.value)}`);
  results.value = await response.json();
});
</script>

<template>
  <input v-model="query" placeholder="Search..." />
  <ul>
    <li v-for="result in results" :key="result">{{ result }}</li>
  </ul>
</template>
```

### watch

`watch` requires you to specify the dependencies explicitly, and gives you access to both the old and new values:

```typescript
import { ref, watch } from 'vue';

const query = ref('');

// Explicit dependency, access to old value
watch(query, (newVal, oldVal) => {
  console.log(`Changed from "${oldVal}" to "${newVal}"`);
});

// Watch multiple sources
watch([query, results], ([newQuery, newResults], [oldQuery, oldResults]) => {
  console.log('Something changed');
});
```

Use `watchEffect` when you want automatic dependency tracking and immediate execution. Use `watch` when you need the previous value, want lazy execution, or need to watch specific sources.

## Practice

Try the [Vue Composition API exercises](/tracks/vue) to practice these concepts with interactive code completion challenges.

Next up: [State with Pinia](/tutorials/vue-state-with-pinia)
