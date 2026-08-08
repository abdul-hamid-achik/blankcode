import type { User } from '@blankcode/shared'
import { defineStore } from 'pinia'
import { useAnalytics } from '~/composables/useAnalytics'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

export const useAuthStore = defineStore('auth', () => {
  const token = useCookie<string | null>('token', { ...AUTH_COOKIE_OPTIONS, default: () => null })
  const refreshToken = useCookie<string | null>('refresh-token', {
    ...AUTH_COOKIE_OPTIONS,
    default: () => null,
  })
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
    // The funnel's one real conversion. Counted only after the server said yes.
    useAnalytics().emit('signup', { method: 'password' })
  }

  /*
   * Loads the user behind the cookie. This is what runs on every SSR of an
   * authed page, so it has two hard rules learned from a real bug:
   *
   * 1. `$fetch`, never `useApi` — the API client builds a relative URL and
   *    calls `fetch` directly, which throws on the server. The old code did
   *    exactly that, and its catch-all called `logout()`: every server render
   *    of a signed-in page cleared both cookies in the response. That was
   *    "the site logs me out every time I refresh".
   * 2. Only a definitive refusal ends the session. A 401 gets one refresh
   *    attempt (the thirty-day token exists for exactly this); anything else
   *    — network blip, 500, timeout — leaves the cookies alone, because a
   *    hiccup is not a revocation.
   */
  async function fetchUser() {
    if (!token.value) return

    const me = () =>
      $fetch<{ data?: User } & User>('/api/users/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      })

    try {
      const response = await me()
      user.value = (response.data ?? response) as User
      return
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode
      if (status !== 401) return // transient — keep the session
    }

    // The access token was refused; spend the refresh token on a new one.
    try {
      const refreshed = await $fetch<{
        data?: { accessToken: string; refreshToken: string }
        accessToken?: string
        refreshToken?: string
      }>('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken: refreshToken.value },
      })
      const tokens = refreshed.data ?? refreshed
      if (!tokens.accessToken || !tokens.refreshToken) throw new Error('no tokens')
      token.value = tokens.accessToken
      refreshToken.value = tokens.refreshToken
      const response = await me()
      user.value = (response.data ?? response) as User
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode
      // Only a definitive refusal of the refresh token ends the session.
      if (status && status >= 400 && status < 500) logout()
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
