---
slug: vue-cmp-002
title: Emits with TypeScript
description: Define and use typed custom events in Vue components.
difficulty: intermediate
hints:
  - defineEmits() accepts a type parameter for event definitions
  - "Event payloads are typed as tuples: [isValid: boolean, message?: string]"
  - Call emit() with the event name first, then its payload arguments
tags:
  - vue
  - emits
  - events
  - typescript
---

Define typed emits for a form input component and wire them to a text input.

```vue
<script setup lang="ts">
interface Props {
  modelValue: string
  label: string
}

const props = ___blank_start___defineProps<Props>()___blank_end___

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: []
  blur: []
  validate: [isValid: boolean, message?: string]
}>()

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('___blank_start___update:modelValue___blank_end___', target.value)
}

const requiredMessage = 'Field is required'

function handleBlur() {
  emit('blur')
  const isValid = props.modelValue.length > 0
  emit('validate', ___blank_start___isValid, isValid ? undefined : requiredMessage___blank_end___)
}

function handleFocus() {
  emit('focus')
}
</script>

<template>
  <input
    :value="modelValue"
    :placeholder="label"
    @input="handleInput"
    @focus="handleFocus"
    @blur="handleBlur"
  />
</template>
```

## Tests

```typescript
import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import FormInput from './form-input.vue'

test('emits update:modelValue on input', async () => {
  const wrapper = mount(FormInput, {
    props: { modelValue: '', label: 'Name' }
  })
  await wrapper.find('input').setValue('John')
  expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  expect(wrapper.emitted('update:modelValue')![0]).toEqual(['John'])
})

test('emits focus event', async () => {
  const wrapper = mount(FormInput, {
    props: { modelValue: '', label: 'Name' }
  })
  await wrapper.find('input').trigger('focus')
  expect(wrapper.emitted('focus')).toBeTruthy()
})

test('emits blur and validate events', async () => {
  const wrapper = mount(FormInput, {
    props: { modelValue: 'test', label: 'Name' }
  })
  await wrapper.find('input').trigger('blur')
  expect(wrapper.emitted('blur')).toBeTruthy()
  expect(wrapper.emitted('validate')).toBeTruthy()
  expect(wrapper.emitted('validate')![0]).toEqual([true, undefined])
})

test('emits validation error for empty value', async () => {
  const wrapper = mount(FormInput, {
    props: { modelValue: '', label: 'Name' }
  })
  await wrapper.find('input').trigger('blur')
  expect(wrapper.emitted('validate')![0]).toEqual([false, 'Field is required'])
})
```
