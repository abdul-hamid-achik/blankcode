import type { User } from '@blankcode/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  let initializePromise: Promise<void> | null = null

  async function initialize() {
    if (isInitialized.value) return
    if (initializePromise) {
      await initializePromise
      return
    }

    initializePromise = (async () => {
      if (!token.value || user.value) {
        isInitialized.value = true
        return
      }
      await fetchUser()
      isInitialized.value = true
    })()

    try {
      await initializePromise
    } finally {
      initializePromise = null
    }
  }

  async function login(email: string, password: string) {
    const response = await api.auth.login({ email, password })
    token.value = response.accessToken
    refreshToken.value = response.refreshToken
    user.value = response.user as User
    localStorage.setItem('token', response.accessToken)
    localStorage.setItem('refreshToken', response.refreshToken)
  }

  async function register(email: string, username: string, password: string) {
    const response = await api.auth.register({ email, username, password })
    token.value = response.accessToken
    refreshToken.value = response.refreshToken
    user.value = response.user as User
    localStorage.setItem('token', response.accessToken)
    localStorage.setItem('refreshToken', response.refreshToken)
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
    api.auth.logout()
    user.value = null
    token.value = null
    refreshToken.value = null
    isInitialized.value = true
  }

  function updateTokens(newAccessToken: string, newRefreshToken: string) {
    token.value = newAccessToken
    refreshToken.value = newRefreshToken
    localStorage.setItem('token', newAccessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
  }

  return {
    user,
    token,
    refreshToken,
    isInitialized,
    isAuthenticated,
    initialize,
    login,
    register,
    fetchUser,
    logout,
    updateTokens,
  }
})
