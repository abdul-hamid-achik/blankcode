import { Drizzle } from '@blankcode/db/client'
import * as bcrypt from 'bcrypt'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, UnauthorizedError } from '../api/errors.js'
import { AuthService, AuthServiceLive } from '../modules/auth/auth.service.js'
import { JwtService } from '../services/jwt.service.js'

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}))

function createMockDb() {
  return {
    query: {
      users: { findFirst: vi.fn() },
      refreshTokens: { findFirst: vi.fn() },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation(() => {
        const result = Promise.resolve([
          {
            id: 'user-1',
            email: 'test@example.com',
            username: 'testuser',
            displayName: 'Test User',
          },
        ])
        ;(result as any).returning = vi.fn().mockResolvedValue([
          {
            id: 'user-1',
            email: 'test@example.com',
            username: 'testuser',
            displayName: 'Test User',
          },
        ])
        return result
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  }
}

function makeTestLayer(mockDb: ReturnType<typeof createMockDb>) {
  const MockDrizzle = Layer.succeed(Drizzle, mockDb as any)
  const MockJwt = Layer.succeed(JwtService, {
    sign: () => Effect.succeed('mock-token'),
    verify: (token: string) => Effect.succeed({ sub: 'user-1', email: 'test@example.com' }),
  })
  return AuthServiceLive.pipe(Layer.provide(MockDrizzle), Layer.provide(MockJwt))
}

async function runService<A, E>(
  effect: Effect.Effect<A, E, AuthService>,
  layer: Layer.Layer<AuthService>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  if (Cause.isFailType(cause)) {
    throw cause.error
  }
  throw new Error('Unexpected effect failure')
}

describe('AuthService', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let testLayer: Layer.Layer<AuthService>

  beforeEach(() => {
    mockDb = createMockDb()
    testLayer = makeTestLayer(mockDb)
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
  })

  describe('register', () => {
    it('creates a new user and returns token', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null)

      const result = await runService(
        Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.register({
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
          })
        }),
        testLayer
      )

      expect(result.accessToken).toBe('mock-token')
      expect(result.refreshToken).toBeDefined()
      expect(result.user).toBeDefined()
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
    })

    it('throws ConflictError if email exists', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({ id: 'existing' })

      await expect(
        runService(
          Effect.gen(function* () {
            const auth = yield* AuthService
            return yield* auth.register({
              email: 'existing@example.com',
              username: 'testuser',
              password: 'password123',
            })
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('throws ConflictError if username exists', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' })

      await expect(
        runService(
          Effect.gen(function* () {
            const auth = yield* AuthService
            return yield* auth.register({
              email: 'test@example.com',
              username: 'existinguser',
              password: 'password123',
            })
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  describe('login', () => {
    it('returns user and token for valid credentials', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        passwordHash: 'hashed-password',
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await runService(
        Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.login({ email: 'test@example.com', password: 'password123' })
        }),
        testLayer
      )

      expect(result.accessToken).toBe('mock-token')
      expect(result.refreshToken).toBeDefined()
      expect(result.user.email).toBe('test@example.com')
    })

    it('throws UnauthorizedError for invalid email', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const auth = yield* AuthService
            return yield* auth.login({ email: 'nonexistent@example.com', password: 'password123' })
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('throws UnauthorizedError for invalid password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(
        runService(
          Effect.gen(function* () {
            const auth = yield* AuthService
            return yield* auth.login({ email: 'test@example.com', password: 'wrongpassword' })
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })

  describe('validateUser', () => {
    it('returns user for valid userId', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await runService(
        Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.validateUser('user-1')
        }),
        testLayer
      )
      expect(result?.id).toBe('user-1')
    })

    it('returns null for invalid userId', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null)

      const result = await runService(
        Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.validateUser('nonexistent')
        }),
        testLayer
      )
      expect(result).toBeNull()
    })
  })

  describe('validateAndRotateRefreshToken', () => {
    it('returns new tokens for valid refresh token', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 'token-record-1',
        userId: 'user-1',
        token: 'lookup-hash',
        tokenHash: 'stored-hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          displayName: 'Test User',
        },
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await runService(
        Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.validateAndRotateRefreshToken('valid-refresh-token')
        }),
        testLayer
      )

      expect(result.accessToken).toBe('mock-token')
      expect(result.refreshToken).toBeDefined()
      expect(result.user.id).toBe('user-1')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.username).toBe('testuser')
      expect(result.refreshTokenExpiresAt).toBeDefined()
      // Verify the old token was revoked (update was called)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('throws UnauthorizedError for invalid token (not found)', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const auth = yield* AuthService
            return yield* auth.validateAndRotateRefreshToken('invalid-token')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('throws UnauthorizedError for expired token', async () => {
      // The DB query filters by gt(expiresAt, new Date()), so an expired token
      // would not be found by the query, returning null
      mockDb.query.refreshTokens.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const auth = yield* AuthService
            return yield* auth.validateAndRotateRefreshToken('expired-token')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('throws UnauthorizedError when bcrypt compare fails', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 'token-record-1',
        userId: 'user-1',
        token: 'lookup-hash',
        tokenHash: 'stored-hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          displayName: 'Test User',
        },
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(
        runService(
          Effect.gen(function* () {
            const auth = yield* AuthService
            return yield* auth.validateAndRotateRefreshToken('tampered-token')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })

  describe('revokeRefreshToken', () => {
    it('revokes a valid token', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 'token-record-1',
        userId: 'user-1',
        token: 'lookup-hash',
        tokenHash: 'stored-hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      await runService(
        Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.revokeRefreshToken('valid-refresh-token')
        }),
        testLayer
      )

      // Verify update was called to set revokedAt
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('is a no-op if token not found', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue(null)

      // Should not throw
      await runService(
        Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.revokeRefreshToken('nonexistent-token')
        }),
        testLayer
      )

      // update should not be called since no token was found
      expect(mockDb.update).not.toHaveBeenCalled()
    })

    it('is a no-op if bcrypt compare fails', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 'token-record-1',
        userId: 'user-1',
        token: 'lookup-hash',
        tokenHash: 'stored-hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await runService(
        Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.revokeRefreshToken('invalid-token')
        }),
        testLayer
      )

      // update should not be called since bcrypt.compare returned false
      expect(mockDb.update).not.toHaveBeenCalled()
    })
  })
})
