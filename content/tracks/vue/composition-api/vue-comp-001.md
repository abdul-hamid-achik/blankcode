---
slug: vue-comp-001
title: Creating Reactive State
description: Use ref and reactive to create reactive state in a Vue component.
difficulty: beginner
hints:
  - ref() is used for primitive values
  - reactive() is used for objects
  - Access ref values with .value in script
tags:
  - vue
  - composition-api
  - reactivity
---

Complete the composable to create a counter with reactive state.

```typescript
import { ___blank_start___ref___blank_end___, computed } from 'vue'

export function useCounter(initialValue = 0) {
  const count = ___blank_start___ref(initialValue)___blank_end___

  const double = computed(() => ___blank_start___count.value * 2___blank_end___)

  function increment() {
    ___blank_start___count.value++___blank_end___
  }

  function decrement() {
    count.value--
  }

  return {
    count,
    double,
    increment,
    decrement,
  }
}
```

## Tests

```typescript
import { expect, test } from 'vitest'
import { useCounter } from './use-counter'

test('initializes with default value', () => {
  const { count } = useCounter()
  expect(count.value).toBe(0)
})

test('initializes with custom value', () => {
  const { count } = useCounter(10)
  expect(count.value).toBe(10)
})

test('increment increases count', () => {
  const { count, increment } = useCounter(5)
  increment()
  expect(count.value).toBe(6)
})

test('double computed is reactive', () => {
  const { count, double, increment } = useCounter(3)
  expect(double.value).toBe(6)
  increment()
  expect(double.value).toBe(8)
})
```
