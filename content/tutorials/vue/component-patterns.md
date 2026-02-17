---
title: "Vue Component Patterns"
slug: "vue-component-patterns"
description: "Learn how to build reusable Vue components with props, events, slots, provide/inject, and more."
track: "vue"
order: 1
difficulty: "beginner"
tags: ["components", "props", "events", "slots", "v-model", "defineModel", "defineEmits", "defineExpose", "provide", "inject", "dynamic-components"]
---

# Vue Component Patterns

Components are the building blocks of any Vue application. This tutorial covers the essential patterns for defining, composing, and communicating between components using Vue 3's `<script setup>` syntax.

## Defining Components with Script Setup

The `<script setup>` syntax is the recommended way to write components in Vue 3. It reduces boilerplate and gives you full TypeScript support out of the box.

```vue
<script setup lang="ts">
import { ref } from 'vue';

const message = ref('Hello from my component!');
</script>

<template>
  <p>{{ message }}</p>
</template>
```

Everything declared at the top level of `<script setup>` is automatically available in the template. No need to return anything from a setup function or register components manually.

## Props with defineProps

Props are how parent components pass data down to children. Use `defineProps` to declare them with full type safety.

### Basic Props

```vue
<script setup lang="ts">
const props = defineProps<{
  title: string;
  count: number;
  isActive?: boolean;
}>();
</script>

<template>
  <div :class="{ active: isActive }">
    <h2>{{ title }}</h2>
    <span>Count: {{ count }}</span>
  </div>
</template>
```

### Props with Defaults

Use `withDefaults` to provide default values:

```vue
<script setup lang="ts">
interface Props {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false,
});
</script>

<template>
  <button :class="`btn-${size}`" :disabled="disabled">
    {{ label }}
  </button>
</template>
```

The parent uses the component like this:

```vue
<template>
  <MyButton label="Click me" size="lg" />
  <MyButton label="Disabled" disabled />
</template>
```

## Emits with defineEmits

Events are how child components communicate back up to parents. Use `defineEmits` with the modern object/tuple syntax (Vue 3.3+):

```vue
<script setup lang="ts">
const emit = defineEmits<{
  update: [value: string]
  delete: []
}>();

function handleSave() {
  emit('update', 'new value');
}

function handleDelete() {
  emit('delete');
}
</script>

<template>
  <div>
    <button @click="handleSave">Save</button>
    <button @click="handleDelete">Delete</button>
  </div>
</template>
```

The parent listens with `@`:

```vue
<template>
  <MyEditor
    @update="(val) => console.log('Updated:', val)"
    @delete="handleDelete"
  />
</template>
```

Each key in the type argument is an event name, and the tuple describes its payload. An empty tuple `[]` means the event carries no data.

## v-model on Components

`v-model` creates two-way binding between parent and child. Vue 3.4+ provides `defineModel` which handles all the wiring automatically.

```vue
<!-- SearchInput.vue -->
<script setup lang="ts">
const model = defineModel<string>();
</script>

<template>
  <input v-model="model" />
</template>
```

The `defineModel` macro returns a ref that is automatically synced with the parent's `v-model`. You use it directly with `v-model` on native elements — no manual `:value`/`@input` wiring needed.

The parent uses it cleanly:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import SearchInput from './SearchInput.vue';

const query = ref('');
</script>

<template>
  <SearchInput v-model="query" />
  <p>Searching for: {{ query }}</p>
</template>
```

You can also use multiple `v-model` bindings with named models:

```vue
<script setup lang="ts">
const firstName = defineModel<string>('firstName');
const lastName = defineModel<string>('lastName');
</script>
```

## Slots

Slots let parent components inject content into a child component's template. They are the key to building flexible, reusable layouts.

### Default Slot

```vue
<!-- Card.vue -->
<template>
  <div class="card">
    <slot />
  </div>
</template>
```

```vue
<!-- Parent -->
<Card>
  <p>This content goes inside the card.</p>
</Card>
```

### Named Slots

Use named slots when a component has multiple content areas:

```vue
<!-- PageLayout.vue -->
<template>
  <div class="page">
    <header><slot name="header" /></header>
    <main><slot /></main>
    <footer><slot name="footer" /></footer>
  </div>
</template>
```

```vue
<!-- Parent -->
<PageLayout>
  <template #header>
    <h1>My Page</h1>
  </template>

  <p>Main content goes here.</p>

  <template #footer>
    <small>Copyright 2026</small>
  </template>
</PageLayout>
```

### Scoped Slots

Scoped slots let the child pass data back to the parent's slot content:

```vue
<!-- ItemList.vue -->
<script setup lang="ts">
defineProps<{ items: string[] }>();
</script>

<template>
  <ul>
    <li v-for="(item, index) in items" :key="index">
      <slot :item="item" :index="index" />
    </li>
  </ul>
</template>
```

```vue
<!-- Parent -->
<ItemList :items="['Apple', 'Banana', 'Cherry']">
  <template #default="{ item, index }">
    <strong>{{ index + 1 }}.</strong> {{ item }}
  </template>
</ItemList>
```

## Provide / Inject

For deeply nested components, passing props through every level gets tedious. `provide` and `inject` let an ancestor share data with any descendant.

### Basic Usage

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provide, ref } from 'vue';

const theme = ref<'light' | 'dark'>('light');

provide('theme', theme);
</script>
```

```vue
<!-- DeepChild.vue (any level of nesting) -->
<script setup lang="ts">
import { inject, type Ref } from 'vue';

// Without a default, inject may return undefined
const theme = inject<Ref<'light' | 'dark'>>('theme');
// theme is Ref<'light' | 'dark'> | undefined
</script>

<template>
  <div :class="`theme-${theme}`">
    Current theme: {{ theme }}
  </div>
</template>
```

### Type-safe Injection Keys

Use `InjectionKey<T>` from Vue to get full type safety and avoid the `| undefined` ambiguity:

```typescript
// keys.ts
import type { InjectionKey, Ref } from 'vue';

export const ThemeKey: InjectionKey<Ref<'light' | 'dark'>> = Symbol('theme');
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provide, ref } from 'vue';
import { ThemeKey } from './keys';

const theme = ref<'light' | 'dark'>('light');
provide(ThemeKey, theme);
</script>
```

```vue
<!-- DeepChild.vue -->
<script setup lang="ts">
import { inject } from 'vue';
import { ThemeKey } from './keys';

// Fully typed as Ref<'light' | 'dark'> | undefined
const theme = inject(ThemeKey);

// Or provide a default to eliminate undefined:
// const theme = inject(ThemeKey, ref('light'));
</script>
```

Use injection keys with `Symbol()` in real applications to avoid naming collisions. Keep provide/inject for truly shared application state like themes, locale, or auth context.

## defineExpose

By default, `<script setup>` components do not expose any of their bindings to the parent via template refs. Use `defineExpose` to explicitly expose properties and methods:

```vue
<!-- Counter.vue -->
<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);

function increment() {
  count.value++;
}

function reset() {
  count.value = 0;
}

// Only these will be accessible via template ref
defineExpose({ count, reset });
</script>

<template>
  <div>
    <span>{{ count }}</span>
    <button @click="increment">+1</button>
  </div>
</template>
```

The parent accesses the exposed API through a template ref:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Counter from './Counter.vue';

const counterRef = ref<InstanceType<typeof Counter>>();

function resetFromParent() {
  counterRef.value?.reset();
  console.log(counterRef.value?.count); // accessible
}
</script>

<template>
  <Counter ref="counterRef" />
  <button @click="resetFromParent">Reset from parent</button>
</template>
```

`defineExpose` is useful for imperative APIs like form validation (`.validate()`), modal controls (`.open()`, `.close()`), or programmatic scrolling.

## Dynamic Components

Use `<component :is>` to dynamically switch between components at runtime:

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import TabHome from './TabHome.vue';
import TabSettings from './TabSettings.vue';
import TabProfile from './TabProfile.vue';

const tabs = {
  home: TabHome,
  settings: TabSettings,
  profile: TabProfile,
} as const;

type TabName = keyof typeof tabs;

const currentTab = ref<TabName>('home');
</script>

<template>
  <div class="tabs">
    <button
      v-for="(_, name) in tabs"
      :key="name"
      :class="{ active: currentTab === name }"
      @click="currentTab = name"
    >
      {{ name }}
    </button>
  </div>

  <component :is="tabs[currentTab]" />
</template>
```

Wrap with `<KeepAlive>` if you want to preserve component state when switching:

```vue
<KeepAlive>
  <component :is="tabs[currentTab]" />
</KeepAlive>
```

## Practice

Try the [Vue component exercises](/tracks/vue) to build components with props, events, and slots in interactive code challenges.

Next up: [Reactivity Deep Dive](/tutorials/vue-reactivity-deep-dive)
