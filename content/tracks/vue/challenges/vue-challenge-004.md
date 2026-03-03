---
slug: vue-challenge-004
title: 'Challenge: Build a Form Validation Composable'
description: Create a reusable form validation composable with custom rules.
difficulty: advanced
type: challenge
tags:
  - composables
  - forms
  - validation
---

# Challenge: Form Validation Composable

## Requirements

Create a `useForm` composable with the following features:

1. **initialValues** - Initial form values object
2. **validationRules** - Validation rules per field
3. **register(name)** - Register field with validation
4. **handleSubmit(onSubmit)** - Handle form submission
5. **errors** - Validation errors ref
6. **touched** - Touched fields ref
7. **isSubmitting** - Submission state ref
8. **isValid** - Form validity computed
9. **resetForm()** - Reset to initial values
10. **setFieldValue(name, value)** - Manually set field value

## Constraints

- Support multiple validation rules per field
- Async validation support
- Real-time validation on blur
- Validate on change (optional)
- Type-safe with TypeScript generics

## Example Usage

```vue
<script setup lang="ts">
const { register, handleSubmit, errors, isSubmitting } = useForm({
  initialValues: {
    email: '',
    password: '',
  },
  validationRules: {
    email: [
      { type: 'required', message: 'Email is required' },
      { type: 'email', message: 'Invalid email' },
    ],
  },
})

const onSubmit = (data) => {
  console.log(data)
}
</script>

<template>
  <form @submit="handleSubmit(onSubmit)">
    <input v-bind="register('email')" />
    <span v-if="errors.email">{{ errors.email }}</span>
    <button :disabled="isSubmitting">Submit</button>
  </form>
</template>
```

Write your complete implementation below:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

// Your implementation here
</script>
```

## Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@vue/test-utils'
import { useForm } from './useForm'

describe('useForm', () => {
  it('should initialize with provided values', () => {
    const { values } = renderHook(() => useForm({
      initialValues: { name: 'John', email: 'john@example.com' },
      validationRules: {},
    }))
    
    expect(values.value.name).toBe('John')
    expect(values.value.email).toBe('john@example.com')
  })

  it('should validate required field', () => {
    const { errors, handleSubmit } = renderHook(() => useForm({
      initialValues: { name: '' },
      validationRules: {
        name: [{ type: 'required', message: 'Name is required' }],
      },
    }))
    
    handleSubmit(() => {})(new Event('submit'))
    
    expect(errors.value.name).toBe('Name is required')
  })

  it('should validate email format', () => {
    const { errors, handleSubmit } = renderHook(() => useForm({
      initialValues: { email: 'invalid' },
      validationRules: {
        email: [{ type: 'email', message: 'Invalid email' }],
      },
    }))
    
    handleSubmit(() => {})(new Event('submit'))
    
    expect(errors.value.email).toBe('Invalid email')
  })

  it('should validate min length', () => {
    const { errors, handleSubmit } = renderHook(() => useForm({
      initialValues: { password: '123' },
      validationRules: {
        password: [{ type: 'minLength', value: 8, message: 'Too short' }],
      },
    }))
    
    handleSubmit(() => {})(new Event('submit'))
    
    expect(errors.value.password).toBe('Too short')
  })

  it('should validate max length', () => {
    const { errors, handleSubmit } = renderHook(() => useForm({
      initialValues: { username: 'verylongusername' },
      validationRules: {
        username: [{ type: 'maxLength', value: 10, message: 'Too long' }],
      },
    }))
    
    handleSubmit(() => {})(new Event('submit'))
    
    expect(errors.value.username).toBe('Too long')
  })

  it('should validate pattern/regex', () => {
    const { errors, handleSubmit } = renderHook(() => useForm({
      initialValues: { phone: '123' },
      validationRules: {
        phone: [{ type: 'pattern', pattern: /^\d{3}-\d{3}-\d{4}$/, message: 'Invalid format' }],
      },
    }))
    
    handleSubmit(() => {})(new Event('submit'))
    
    expect(errors.value.phone).toBe('Invalid format')
  })

  it('should validate custom function', () => {
    const { errors, handleSubmit } = renderHook(() => useForm({
      initialValues: { age: '25' },
      validationRules: {
        age: [{ 
          type: 'custom', 
          validator: (value: string) => parseInt(value) >= 18,
          message: 'Must be 18+' 
        }],
      },
    }))
    
    handleSubmit(() => {})(new Event('submit'))
    
    expect(errors.value.age).toBeUndefined()
  })

  it('should track touched fields', () => {
    const { touched, register } = renderHook(() => useForm({
      initialValues: { name: '' },
      validationRules: {
        name: [{ type: 'required', message: 'Required' }],
      },
    }))
    
    register('name').onBlur()
    
    expect(touched.value.name).toBe(true)
  })

  it('should call onSubmit with form data', () => {
    const onSubmit = vi.fn()
    const { handleSubmit } = renderHook(() => useForm({
      initialValues: { name: 'John' },
      validationRules: {},
    }))
    
    handleSubmit(onSubmit)(new Event('submit'))
    
    expect(onSubmit).toHaveBeenCalledWith({ name: 'John' })
  })

  it('should not submit if form is invalid', () => {
    const onSubmit = vi.fn()
    const { handleSubmit } = renderHook(() => useForm({
      initialValues: { email: 'invalid' },
      validationRules: {
        email: [{ type: 'email', message: 'Invalid' }],
      },
    }))
    
    handleSubmit(onSubmit)(new Event('submit'))
    
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should set isSubmitting during submission', async () => {
    const { isSubmitting, handleSubmit } = renderHook(() => useForm({
      initialValues: { name: 'John' },
      validationRules: {},
    }))
    
    expect(isSubmitting.value).toBe(false)
    
    handleSubmit(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })(new Event('submit'))
    
    expect(isSubmitting.value).toBe(true)
  })

  it('should reset form to initial values', () => {
    const { values, setFieldValue, resetForm } = renderHook(() => useForm({
      initialValues: { name: 'John' },
      validationRules: {},
    }))
    
    setFieldValue('name', 'Jane')
    resetForm()
    
    expect(values.value.name).toBe('John')
  })

  it('should manually set field value', () => {
    const { values, setFieldValue } = renderHook(() => useForm({
      initialValues: { name: 'John' },
      validationRules: {},
    }))
    
    setFieldValue('name', 'Jane')
    
    expect(values.value.name).toBe('Jane')
  })

  it('should validate on change', () => {
    const { errors, register } = renderHook(() => useForm({
      initialValues: { email: '' },
      validationRules: {
        email: [{ type: 'email', message: 'Invalid email' }],
      },
      validateOnChange: true,
    }))
    
    register('email').onChange('invalid')
    
    expect(errors.value.email).toBe('Invalid email')
  })

  it('should support async validation', async () => {
    vi.useFakeTimers()
    
    const { errors, setFieldValue, handleSubmit } = renderHook(() => useForm({
      initialValues: { username: '' },
      validationRules: {
        username: [{
          type: 'async',
          validator: async (value: string) => {
            await new Promise(resolve => setTimeout(resolve, 100))
            return value !== 'taken'
          },
          message: 'Username taken',
        }],
      },
    }))
    
    setFieldValue('username', 'taken')
    handleSubmit(() => {})(new Event('submit'))
    
    await vi.advanceTimersByTimeAsync(100)
    
    expect(errors.value.username).toBe('Username taken')
    
    vi.useRealTimers()
  })

  it('should compute isValid flag', () => {
    const wrapper = renderHook(() => useForm({
      initialValues: { name: '', email: '' },
      validationRules: {
        name: [{ type: 'required', message: 'Required' }],
        email: [{ type: 'email', message: 'Invalid' }],
      },
    }))
    
    expect(wrapper.isValid.value).toBe(false)
    
    wrapper.setFieldValue('name', 'John')
    wrapper.setFieldValue('email', 'john@example.com')
    
    expect(wrapper.isValid.value).toBe(true)
  })
})
```
