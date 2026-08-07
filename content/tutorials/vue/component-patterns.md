---
title: "Vue Component Patterns"
slug: "vue-component-patterns"
description: "Props, emits, v-model, and slots as the real contract between a Vue component and everything that calls it — plus why defineProps and defineEmits are not functions you can pass around."
track: "vue"
order: 1
difficulty: "beginner"
tags: ["components", "props", "events", "slots", "v-model", "defineModel", "defineEmits", "defineExpose", "provide", "inject", "dynamic-components"]
practice:
  concept: "components"
  label: "Components"
---

A Vue component is a boundary. Everything inside `<script setup>` is private until you say otherwise — props come in, events go out, and slots are the only place markup crosses that boundary in the other direction. The patterns below are what actually enforces the boundary, not just the syntax for writing it.

## Props: a one-way, read-only contract

`defineProps` declares what a component accepts, with full type inference and no runtime import — because it isn't one. `defineProps`, `defineEmits`, `defineModel`, and `defineExpose` are compiler macros: the compiler reads the literal source of the call and erases it before anything runs. That is why you cannot write `import { defineProps } from 'vue'`, cannot assign the call to a variable and invoke it later, and cannot put it inside an `if`. It has to appear once, directly, at the top level of `<script setup>`.

```vue
<script setup lang="ts">
interface Props {
  label: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})
</script>

<template>
  <button :class="`btn-${props.size}`">{{ props.label }}</button>
</template>
```

Props are read-only from inside the component. Assigning to `props.label` does not throw — Vue logs a warning, and the value snaps back on the parent's next render, because the parent's data is still the single source of truth. If a prop needs to change locally, copy it into a `ref` on setup and treat the prop as an initial value only.

::code-blank{lang="typescript" href="/tracks/vue/components" label="practice components for real"}
---
code: |
  // A component that accepts a required title and an optional count
  const props = ___blank_start___defineProps___blank_end___<{ title: string; count?: number }>()
---
::

## Emitting events, and what v-model actually desugars to

`defineEmits` declares outbound events the same way `defineProps` declares inbound data — as a type, not a runtime schema:

```typescript
const emit = defineEmits<{
  save: [value: string]
  close: []
}>()

function handleSave(value: string) {
  emit('save', value)
}
```

`v-model` on a component is built entirely from a prop and an event — `defineModel` is sugar over both directions at once. `defineModel<string>()` desugars to a `modelValue` prop plus an `update:modelValue` emit; write `defineModel<string>('email')` and it desugars to `email` / `update:email` instead. The macro hands back a real, writable `ref`: assigning to it updates the local value immediately and emits the update event in the same step, so the binding stays purely prop-and-event underneath, exactly like it did before Vue 3.4 introduced the macro.

```vue
<script setup lang="ts">
const model = defineModel<string>()
</script>

<template>
  <input v-model="model" />
</template>
```

::code-blank{lang="typescript" href="/tracks/vue/components" label="practice components for real"}
---
code: |
  // Two-way bound search box, wired entirely through v-model
  const model = ___blank_start___defineModel___blank_end___<string>()
---
::

## Slots: handing back markup, not a value

A slot is not `innerHTML`. Default and named slots let a parent drop markup into designated spots in a child's template:

```vue
<!-- PageLayout.vue -->
<template>
  <header><slot name="header" /></header>
  <main><slot /></main>
</template>
```

A scoped slot goes further — the child hands data back to the slot content, so the parent decides how to render it:

```vue
<!-- ItemList.vue -->
<template>
  <li v-for="item in items" :key="item.id">
    <slot :item="item" />
  </li>
</template>
```

```vue
<!-- Parent -->
<ItemList :items="products">
  <template #default="{ item }">
    <strong>{{ item.name }}</strong>
  </template>
</ItemList>
```

The mental model that actually matches the implementation: slot content is a render function, defined in the parent's file and invoked by the child during the child's own render, with the child's bound data (`item`) passed as its argument. That is why the parent's `{{ item.name }}` still has full access to the parent's own reactive scope — the closure travels with the function — while also receiving whatever the child chose to pass in. It behaves like a function call across the boundary, not like copying HTML through it.

## provide/inject is a tree tool, not a state manager

`provide` and `inject` solve one problem: passing data to a descendant at an unknown depth without threading it through every prop in between. Reach for it when the data is genuinely about position in the tree — a theme, a form's validation context, a modal's controlling instance.

```typescript
// keys.ts
import type { InjectionKey, Ref } from 'vue'

export const ThemeKey: InjectionKey<Ref<'light' | 'dark'>> = Symbol('theme')
```

Anything several unrelated parts of the app need to read and write — a signed-in user, a shopping cart, feature flags — belongs in a Pinia store, not a provided ref. provide/inject has no devtools panel, no defined cleanup lifecycle, and silently returns `undefined` if a descendant renders outside the provider; a store is explicit and always reachable.

::code-blank{lang="typescript" href="/tracks/vue/components" label="practice components for real"}
---
code: |
  // Shares the current theme with every descendant, however deep
  ___blank_start___provide___blank_end___('theme', theme)
---
::

## Where this bites

**Mutating a prop directly.** `props.count++` doesn't throw, so the bug hides until something else causes the parent to re-render — then the value snaps back and the mutation looks like it randomly reverted. Copy the prop into a local `ref` on setup, or emit an event and let the parent own the change.

**An object or array default without a factory.** `withDefaults(defineProps<Props>(), { tags: [] })` looks reasonable and Vue accepts it, but every instance of the component then shares that exact array reference — one instance pushing to it mutates it for all of them. Use `default: () => []` so each instance gets its own copy.

**Destructuring props for convenience.** `const { title } = defineProps<Props>()` reads `title` once and hands you a plain string, not a tracked reference — pass that variable into a composable or a `watch` and it never updates again even though the prop keeps changing on screen. Keep `props.title` at the read site, or wrap it with `toRef(props, 'title')` before it leaves the component.

**Assuming a parent can reach into a child through a template ref.** `<script setup>` components are closed by default — nothing is visible to `counterRef.value` until the child calls `defineExpose({ ... })` naming exactly what it wants to share. Without it, every property reads as `undefined`, which looks like a timing bug but is a visibility one.
