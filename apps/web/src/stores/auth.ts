import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@blankcode/shared'
import { api } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function login(email: string, password: string) {
    const response = await api.auth.login({ email, password })
    token.value = response.token
    user.value = response.user as User
    localStorage.setItem('token', response.token)
  }

  async function register(email: string, username: string, password: string) {
    const response = await api.auth.register({ email, username, password })
    token.value = response.token
    user.value = response.user as User
    localStorage.setItem('token', response.token)
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      const response = await api.users.getMe()
      user.value = response as User
    } catch {
      logout()
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    register,
    fetchUser,
    logout,
  }
})
