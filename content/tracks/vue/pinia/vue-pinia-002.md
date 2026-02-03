---
slug: vue-pinia-002
title: Async Actions in Pinia
description: Handle async operations like API calls in Pinia stores.
difficulty: advanced
hints:
  - Actions can be async functions
  - Track loading and error states in the store
  - Use try/catch for error handling
tags:
  - vue
  - pinia
  - async
  - api
---

Create a store that fetches and manages user data.

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface User {
  id: number;
  name: string;
  email: string;
}

// Simulated API
async function fetchUsersApi(): Promise<User[]> {
  await new Promise(r => setTimeout(r, 100))
  return [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
  ]
}

export const useUserStore = defineStore('users', () => {
  const users = ref<User[]>([])
  const isLoading = ref(false)
  const error = ref<___blank_start___string | null___blank_end___>(null)

  const userCount = computed(() => users.value.length)

  const getUserById = computed(() => {
    return (id: number) => users.value.___blank_start___find((u) => u.id === id)___blank_end___
  })

  ___blank_start___async function___blank_end___ fetchUsers() {
    isLoading.value = true
    error.value = null

    try {
      users.value = ___blank_start___await fetchUsersApi()___blank_end___
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      ___blank_start___isLoading.value = false___blank_end___
    }
  }

  function clearUsers() {
    users.value = []
    error.value = null
  }

  return {
    users,
    isLoading,
    error,
    userCount,
    getUserById,
    fetchUsers,
    clearUsers,
  }
})
```

## Tests

```typescript
import { expect, test, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from './user-store'

beforeEach(() => {
  setActivePinia(createPinia())
})

test('starts with empty state', () => {
  const store = useUserStore()
  expect(store.users).toEqual([])
  expect(store.isLoading).toBe(false)
  expect(store.error).toBeNull()
})

test('fetches users', async () => {
  const store = useUserStore()
  await store.fetchUsers()
  expect(store.users.length).toBeGreaterThan(0)
  expect(store.isLoading).toBe(false)
})

test('sets loading state during fetch', async () => {
  const store = useUserStore()
  const promise = store.fetchUsers()
  expect(store.isLoading).toBe(true)
  await promise
  expect(store.isLoading).toBe(false)
})

test('getUserById returns correct user', async () => {
  const store = useUserStore()
  await store.fetchUsers()
  const user = store.getUserById(1)
  expect(user?.name).toBe('Alice')
})

test('getUserById returns undefined for invalid id', async () => {
  const store = useUserStore()
  await store.fetchUsers()
  const user = store.getUserById(999)
  expect(user).toBeUndefined()
})

test('clearUsers resets state', async () => {
  const store = useUserStore()
  await store.fetchUsers()
  store.clearUsers()
  expect(store.users).toEqual([])
})
```
