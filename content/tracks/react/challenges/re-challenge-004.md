---
slug: re-challenge-004
title: 'Challenge: Build a Form Validation Hook'
description: Create a reusable form validation hook with custom rules.
difficulty: advanced
type: challenge
tags:
  - hooks
  - forms
  - validation
---

# Challenge: Form Validation Hook

## Requirements

Create a `useForm` hook with the following features:

1. **initialValues** - Initial form values object
2. **validationRules** - Validation rules per field
3. **register(name)** - Register field with validation
4. **handleSubmit(onSubmit)** - Handle form submission
5. **errors** - Validation errors object
6. **touched** - Touched fields tracking
7. **isSubmitting** - Submission state
8. **isValid** - Form validity flag
9. **resetForm()** - Reset to initial values
10. **setFieldValue(name, value)** - Manually set field value

## Constraints

- Support multiple validation rules per field
- Async validation support (e.g., check username availability)
- Real-time validation on blur
- Validate on change (optional)
- Type-safe with TypeScript generics

## Example Usage

```tsx
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
    password: [
      { type: 'required', message: 'Password is required' },
      { type: 'minLength', value: 8, message: 'Min 8 characters' },
    ],
  },
})

return (
  <form onSubmit={handleSubmit(onSubmit)}>
    <input {...register('email')} />
    {errors.email && <span>{errors.email}</span>}
    <button type="submit" disabled={isSubmitting}>Submit</button>
  </form>
)
```

Write your complete implementation below:

```tsx
import { useState, useCallback } from 'react';

// Your implementation here
```

## Tests

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForm } from './useForm'

describe('useForm', () => {
  it('should initialize with provided values', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { name: 'John', email: 'john@example.com' },
      validationRules: {},
    }))
    
    expect(result.current.register('name').value).toBe('John')
    expect(result.current.register('email').value).toBe('john@example.com')
  })

  it('should validate required field', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { name: '' },
      validationRules: {
        name: [{ type: 'required', message: 'Name is required' }],
      },
    }))
    
    act(() => {
      result.current.handleSubmit((data) => {})(new Event('submit') as any)
    })
    
    expect(result.current.errors.name).toBe('Name is required')
  })

  it('should validate email format', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { email: 'invalid' },
      validationRules: {
        email: [{ type: 'email', message: 'Invalid email' }],
      },
    }))
    
    act(() => {
      result.current.handleSubmit((data) => {})(new Event('submit') as any)
    })
    
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('should validate min length', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { password: '123' },
      validationRules: {
        password: [{ type: 'minLength', value: 8, message: 'Too short' }],
      },
    }))
    
    act(() => {
      result.current.handleSubmit((data) => {})(new Event('submit') as any)
    })
    
    expect(result.current.errors.password).toBe('Too short')
  })

  it('should validate max length', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { username: 'verylongusername' },
      validationRules: {
        username: [{ type: 'maxLength', value: 10, message: 'Too long' }],
      },
    }))
    
    act(() => {
      result.current.handleSubmit((data) => {})(new Event('submit') as any)
    })
    
    expect(result.current.errors.username).toBe('Too long')
  })

  it('should validate pattern/regex', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { phone: '123' },
      validationRules: {
        phone: [{ type: 'pattern', pattern: /^\d{3}-\d{3}-\d{4}$/, message: 'Invalid format' }],
      },
    }))
    
    act(() => {
      result.current.handleSubmit((data) => {})(new Event('submit') as any)
    })
    
    expect(result.current.errors.phone).toBe('Invalid format')
  })

  it('should validate custom function', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { age: '25' },
      validationRules: {
        age: [{ 
          type: 'custom', 
          validator: (value: string) => parseInt(value) >= 18,
          message: 'Must be 18+' 
        }],
      },
    }))
    
    act(() => {
      result.current.handleSubmit((data) => {})(new Event('submit') as any)
    })
    
    expect(result.current.errors.age).toBeUndefined()
  })

  it('should track touched fields', async () => {
    const { result } = renderHook(() => useForm({
      initialValues: { name: '' },
      validationRules: {
        name: [{ type: 'required', message: 'Required' }],
      },
    }))
    
    act(() => {
      result.current.register('name').onBlur()
    })
    
    expect(result.current.touched.name).toBe(true)
  })

  it('should call onSubmit with form data', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() => useForm({
      initialValues: { name: 'John' },
      validationRules: {},
    }))
    
    act(() => {
      result.current.handleSubmit(onSubmit)(new Event('submit') as any)
    })
    
    expect(onSubmit).toHaveBeenCalledWith({ name: 'John' })
  })

  it('should not submit if form is invalid', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() => useForm({
      initialValues: { email: 'invalid' },
      validationRules: {
        email: [{ type: 'email', message: 'Invalid' }],
      },
    }))
    
    act(() => {
      result.current.handleSubmit(onSubmit)(new Event('submit') as any)
    })
    
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should set isSubmitting during submission', async () => {
    const { result } = renderHook(() => useForm({
      initialValues: { name: 'John' },
      validationRules: {},
    }))
    
    expect(result.current.isSubmitting).toBe(false)
    
    act(() => {
      result.current.handleSubmit(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })(new Event('submit') as any)
    })
    
    expect(result.current.isSubmitting).toBe(true)
  })

  it('should reset form to initial values', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { name: 'John', email: 'john@example.com' },
      validationRules: {},
    }))
    
    act(() => {
      result.current.setFieldValue('name', 'Jane')
      result.current.resetForm()
    })
    
    expect(result.current.register('name').value).toBe('John')
  })

  it('should manually set field value', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { name: 'John' },
      validationRules: {},
    }))
    
    act(() => {
      result.current.setFieldValue('name', 'Jane')
    })
    
    expect(result.current.register('name').value).toBe('Jane')
  })

  it('should validate on change', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { email: '' },
      validationRules: {
        email: [{ type: 'email', message: 'Invalid email' }],
      },
      validateOnChange: true,
    }))
    
    act(() => {
      result.current.register('email').onChange('invalid')
    })
    
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('should support async validation', async () => {
    vi.useFakeTimers()
    
    const { result } = renderHook(() => useForm({
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
    
    act(() => {
      result.current.setFieldValue('username', 'taken')
      result.current.handleSubmit((data) => {})(new Event('submit') as any)
    })
    
    await vi.advanceTimersByTimeAsync(100)
    
    expect(result.current.errors.username).toBe('Username taken')
    
    vi.useRealTimers()
  })

  it('should compute isValid flag', () => {
    const { result } = renderHook(() => useForm({
      initialValues: { name: '', email: '' },
      validationRules: {
        name: [{ type: 'required', message: 'Required' }],
        email: [{ type: 'email', message: 'Invalid' }],
      },
    }))
    
    expect(result.current.isValid).toBe(false)
    
    act(() => {
      result.current.setFieldValue('name', 'John')
      result.current.setFieldValue('email', 'john@example.com')
    })
    
    expect(result.current.isValid).toBe(true)
  })
})
```
