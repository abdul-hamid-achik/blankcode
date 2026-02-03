---
slug: vue-comp-002
title: Computed Properties
description: Create computed properties that derive values from reactive state.
difficulty: beginner
hints:
  - computed() takes a getter function
  - Computed values are cached and only recalculate when dependencies change
  - Access computed values like refs with .value
tags:
  - vue
  - computed
  - reactivity
---

Create computed properties for a shopping cart.

```typescript
import { ref, ___blank_start___computed___blank_end___ } from 'vue'

interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

export function useCart() {
  const items = ref<CartItem[]>([])

  const totalItems = computed(() => {
    return items.value.___blank_start___reduce___blank_end___((sum, item) => sum + item.quantity, 0)
  })

  const totalPrice = computed(() => {
    return items.value.reduce((sum, item) => {
      return ___blank_start___sum + item.price * item.quantity___blank_end___
    }, 0)
  })

  const isEmpty = computed(() => ___blank_start___items.value.length === 0___blank_end___)

  function addItem(item: CartItem) {
    items.value.push(item)
  }

  function clearCart() {
    items.value = []
  }

  return { items, totalItems, totalPrice, isEmpty, addItem, clearCart }
}
```

## Tests

```typescript
import { expect, test } from 'vitest'
import { useCart } from './use-cart'

test('starts with empty cart', () => {
  const { items, isEmpty } = useCart()
  expect(items.value).toEqual([])
  expect(isEmpty.value).toBe(true)
})

test('calculates total items', () => {
  const { totalItems, addItem } = useCart()
  addItem({ name: 'Apple', price: 1, quantity: 3 })
  addItem({ name: 'Banana', price: 0.5, quantity: 2 })
  expect(totalItems.value).toBe(5)
})

test('calculates total price', () => {
  const { totalPrice, addItem } = useCart()
  addItem({ name: 'Apple', price: 1, quantity: 3 })
  addItem({ name: 'Banana', price: 0.5, quantity: 2 })
  expect(totalPrice.value).toBe(4) // 3*1 + 2*0.5
})

test('isEmpty updates when items change', () => {
  const { isEmpty, addItem, clearCart } = useCart()
  expect(isEmpty.value).toBe(true)
  addItem({ name: 'Apple', price: 1, quantity: 1 })
  expect(isEmpty.value).toBe(false)
  clearCart()
  expect(isEmpty.value).toBe(true)
})
```
