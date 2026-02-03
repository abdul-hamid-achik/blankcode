---
slug: vue-cmp-002
title: Emits with TypeScript
description: Define and use typed custom events in Vue components.
difficulty: intermediate
hints:
  - defineEmits() accepts a type parameter for event definitions
  - Event payloads are typed in the emit function
  - Use emit() to trigger events
tags:
  - vue
  - emits
  - events
  - typescript
---

Define typed emits for a form input component.

```typescript
// form-input.vue - script setup
interface Props {
  modelValue: string;
  label: string;
}

const props = defineProps<Props>()

const emit = ___blank_start___defineEmits<{___blank_end___
  'update:modelValue': [value: string];
  'focus': [];
  'blur': [];
  'validate': [isValid: boolean, message?: string];
___blank_start___}>()___blank_end___

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  ___blank_start___emit('update:modelValue', target.value)___blank_end___
}

function handleBlur() {
  emit('blur')
  const isValid = props.modelValue.length > 0
  emit(___blank_start___'validate', isValid, isValid ? undefined : 'Field is required'___blank_end___)
}

function handleFocus() {
  emit('focus')
}
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
