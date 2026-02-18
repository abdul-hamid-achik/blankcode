import type { User } from '@blankcode/shared'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const token = useCookie<string | null>('token', { default: () => null })
  const refreshToken = useCookie<string | null>('refresh-token', { default: () => null })
  const user = ref<User | null>(null)
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
    const api = useApi()
    const response = await api.auth.login({ email, password })
    token.value = response.accessToken
    refreshToken.value = response.refreshToken
    user.value = response.user as User
  }

  async function register(email: string, username: string, password: string) {
    const api = useApi()
    const response = await api.auth.register({ email, username, password })
    token.value = response.accessToken
    refreshToken.value = response.refreshToken
    user.value = response.user as User
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      const api = useApi()
      const response = await api.users.getMe()
      user.value = response as User
    } catch {
      logout()
    }
  }

  function logout() {
    if (import.meta.client) {
      const api = useApi()
      api.auth.logout()
    }
    user.value = null
    token.value = null
    refreshToken.value = null
    isInitialized.value = true
  }

  function updateTokens(newAccessToken: string, newRefreshToken: string) {
    token.value = newAccessToken
    refreshToken.value = newRefreshToken
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
