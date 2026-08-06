---
slug: vue-cmp-001
title: Props with TypeScript
description: Define typed props in Vue components using the Composition API.
difficulty: beginner
hints:
  - defineProps() accepts a generic type parameter
  - Props can have default values using withDefaults()
  - Access props via the props object (not by destructuring) so they stay reactive
tags:
  - vue
  - props
  - typescript
  - components
---

Define typed props for a Button component and render it.

```vue
<script setup lang="ts">
import { ___blank_start___computed___blank_end___ } from 'vue'

interface Props {
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = ___blank_start___withDefaults___blank_end___(___blank_start___defineProps<Props>()___blank_end___, {
  variant: 'primary',
  disabled: false,
  size: 'md',
})

const buttonClasses = computed(() => [
  'btn',
  `btn-${props.variant}`,
  `btn-${___blank_start___props.size___blank_end___}`,
  { 'btn-disabled': props.disabled },
])
</script>

<template>
  <button :class="buttonClasses" :disabled="props.disabled">{{ label }}</button>
</template>
```

## Tests

```typescript
import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './button.vue'

test('renders label', () => {
  const wrapper = mount(Button, { props: { label: 'Click me' } })
  expect(wrapper.text()).toContain('Click me')
})

test('applies default variant', () => {
  const wrapper = mount(Button, { props: { label: 'Test' } })
  expect(wrapper.classes()).toContain('btn-primary')
})

test('applies custom variant', () => {
  const wrapper = mount(Button, { props: { label: 'Test', variant: 'danger' } })
  expect(wrapper.classes()).toContain('btn-danger')
})

test('applies size class', () => {
  const wrapper = mount(Button, { props: { label: 'Test', size: 'lg' } })
  expect(wrapper.classes()).toContain('btn-lg')
})

test('applies disabled class when disabled', () => {
  const wrapper = mount(Button, { props: { label: 'Test', disabled: true } })
  expect(wrapper.classes()).toContain('btn-disabled')
})
```
