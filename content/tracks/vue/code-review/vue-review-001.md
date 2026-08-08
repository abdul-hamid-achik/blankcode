---
slug: vue-review-001
title: 'Review: a cart total that never moves'
description: The cart composable below passes its tests. Add an item after setup and the total stays where it was. One line decides whether this is a snapshot or a formula.
difficulty: intermediate
type: review
hints:
  - The shipped tests read the total exactly once, immediately after setup. What would a second reading, after a change, show?
  - ref(expression) evaluates the expression a single time, on that line. What keeps re-evaluating?
  - The fix is not to update the total on every mutation. It is to declare it as something Vue recomputes.
tags:
  - code-review
  - reactivity
  - computed
---

You asked a model for a small cart composable: items, an `add` function, and a
running total. It produced this, with tests. The tests pass.

The total is frozen at its birth value. `ref(sum(items))` runs `sum` once, at
setup, and stores the resulting number — a snapshot wearing the type of a
reactive value. Nothing about it ever recomputes, because nothing was ever
told to. Every shipped test reads the total exactly once, right after setup,
which is the single moment a snapshot and a formula agree.

This is the most common reactivity bug in generated Vue code, and its tell is
in the types: the total is data, but it should be a derivation.

Find the defect and fix it. You are graded on tests you cannot see.

```typescript
import { reactive, ref, type Ref } from 'vue'

export interface CartItem {
  name: string
  price: number
  quantity: number
}

export function useCart() {
  const items = reactive<CartItem[]>([])

  const total: Ref<number> = ref(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  function add(item: CartItem): void {
    items.push(item)
  }

  return { items, total, add }
}
```

## The tests it came with

These all pass. Each one reads `total` once, at the only instant the bug
cannot show.

```typescript
import { describe, expect, it } from 'vitest'

describe('useCart', () => {
  it('starts empty with a zero total', () => {
    const cart = useCart()
    expect(cart.items).toHaveLength(0)
    expect(cart.total.value).toBe(0)
  })

  it('adds items', () => {
    const cart = useCart()
    cart.add({ name: 'coffee', price: 4, quantity: 2 })
    expect(cart.items).toHaveLength(1)
  })
})
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { useCart } from './solution'

describe('useCart', () => {
  it('starts empty with a zero total', () => {
    const cart = useCart()
    expect(cart.items).toHaveLength(0)
    expect(cart.total.value).toBe(0)
  })

  it('adds items', () => {
    const cart = useCart()
    cart.add({ name: 'coffee', price: 4, quantity: 2 })
    expect(cart.items).toHaveLength(1)
  })

  it('the total follows an added item', () => {
    const cart = useCart()
    cart.add({ name: 'coffee', price: 4, quantity: 2 })
    expect(cart.total.value).toBe(8)
  })

  it('the total follows several additions', () => {
    const cart = useCart()
    cart.add({ name: 'coffee', price: 4, quantity: 1 })
    cart.add({ name: 'beans', price: 12, quantity: 2 })
    expect(cart.total.value).toBe(28)
  })

  it('the total follows a quantity edit on an existing item', () => {
    // Deeper than push: mutating a property of an item already in the cart
    // must also flow through. A formula over reactive items does this for
    // free; anything hand-maintained forgets a path eventually.
    const cart = useCart()
    cart.add({ name: 'coffee', price: 4, quantity: 1 })
    cart.items[0].quantity = 5
    expect(cart.total.value).toBe(20)
  })
})
```

## Solution

```typescript
import { computed, reactive, type ComputedRef } from 'vue'

export interface CartItem {
  name: string
  price: number
  quantity: number
}

export function useCart() {
  const items = reactive<CartItem[]>([])

  // The original wrote ref(items.reduce(...)): reduce ran once, at setup,
  // and the resulting NUMBER was stored — a snapshot with a reactive type
  // signature. computed stores the FORMULA. Vue tracks what the formula
  // reads (every price and quantity it touches), so any mutation along any
  // path — push, splice, or editing one item's quantity — recomputes it.
  const total: ComputedRef<number> = computed(() =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  function add(item: CartItem): void {
    items.push(item)
  }

  return { items, total, add }
}
```
