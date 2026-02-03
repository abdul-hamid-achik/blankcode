import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api'

vi.mock('@/api')

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(localStorage.getItem).mockReturnValue(null)
  })

  describe('initial state', () => {
    it('starts with no user', () => {
      const store = useAuthStore()
      expect(store.user).toBeNull()
    })

    it('starts with no token if not in localStorage', () => {
      const store = useAuthStore()
      expect(store.token).toBeNull()
    })

    it('loads token from localStorage', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('stored-token')
      const store = useAuthStore()
      expect(store.token).toBe('stored-token')
    })

    it('isAuthenticated is false without user and token', () => {
      const store = useAuthStore()
      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('login', () => {
    it('sets user and token on successful login', async () => {
      vi.mocked(api.auth.login).mockResolvedValue({
        user: { id: '1', email: 'test@example.com' } as any,
        token: 'new-token',
      })

      const store = useAuthStore()
      await store.login('test@example.com', 'password')

      expect(store.user).toBeDefined()
      expect(store.token).toBe('new-token')
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-token')
    })

    it('propagates errors from API', async () => {
      vi.mocked(api.auth.login).mockRejectedValue(new Error('Invalid credentials'))

      const store = useAuthStore()
      await expect(store.login('test@example.com', 'wrong')).rejects.toThrow(
        'Invalid credentials'
      )
    })
  })

  describe('register', () => {
    it('sets user and token on successful registration', async () => {
      vi.mocked(api.auth.register).mockResolvedValue({
        user: { id: '1', email: 'new@example.com', username: 'newuser' } as any,
        token: 'new-token',
      })

      const store = useAuthStore()
      await store.register('new@example.com', 'newuser', 'password')

      expect(store.user).toBeDefined()
      expect(store.token).toBe('new-token')
    })
  })

  describe('fetchUser', () => {
    it('fetches user when token exists', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue('existing-token')
      vi.mocked(api.users.getMe).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
      } as any)

      const store = useAuthStore()
      await store.fetchUser()

      expect(store.user).toBeDefined()
      expect(api.users.getMe).toHaveBeenCalled()
    })

    it('does nothing when no token', async () => {
      const store = useAuthStore()
      await store.fetchUser()

      expect(api.users.getMe).not.toHaveBeenCalled()
    })

    it('logs out on fetch error', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-token')
      vi.mocked(api.users.getMe).mockRejectedValue(new Error('Unauthorized'))

      const store = useAuthStore()
      await store.fetchUser()

      expect(store.user).toBeNull()
      expect(store.token).toBeNull()
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })
  })

  describe('logout', () => {
    it('clears user and token', async () => {
      vi.mocked(api.auth.login).mockResolvedValue({
        user: { id: '1' } as any,
        token: 'token',
      })

      const store = useAuthStore()
      await store.login('test@example.com', 'password')
      store.logout()

      expect(store.user).toBeNull()
      expect(store.token).toBeNull()
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })
  })
})
