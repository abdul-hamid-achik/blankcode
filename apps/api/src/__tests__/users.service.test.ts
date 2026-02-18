import { Drizzle } from '@blankcode/db/client'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '../api/errors.js'
import { UsersService, UsersServiceLive } from '../modules/users/users.service.js'

function createMockDb() {
  return {
    query: {
      users: { findFirst: vi.fn() },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }
}

function makeTestLayer(mockDb: ReturnType<typeof createMockDb>) {
  return UsersServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as any)))
}

async function runService<A, E>(
  effect: Effect.Effect<A, E, UsersService>,
  layer: Layer.Layer<UsersService>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  if (Cause.isFailType(cause)) {
    throw cause.error
  }
  throw new Error('Unexpected effect failure')
}

describe('UsersService', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let testLayer: Layer.Layer<UsersService>

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
    createdAt: new Date(),
  }

  beforeEach(() => {
    mockDb = createMockDb()
    testLayer = makeTestLayer(mockDb)
  })

  describe('findById', () => {
    it('returns user by id', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* UsersService
          return yield* svc.findById('user-1')
        }),
        testLayer
      )

      expect(result.id).toBe('user-1')
      expect(result.email).toBe('test@example.com')
      expect(result.username).toBe('testuser')
      expect(result.displayName).toBe('Test User')
    })

    it('throws NotFoundError for invalid id', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* UsersService
            return yield* svc.findById('nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('findByUsername', () => {
    it('returns user without email', async () => {
      const publicUser = {
        id: 'user-1',
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: null,
        createdAt: new Date(),
      }
      mockDb.query.users.findFirst.mockResolvedValue(publicUser)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* UsersService
          return yield* svc.findByUsername('testuser')
        }),
        testLayer
      )

      expect(result.id).toBe('user-1')
      expect(result.username).toBe('testuser')
      expect(result.displayName).toBe('Test User')
      expect(result).not.toHaveProperty('email')
    })

    it('throws NotFoundError for unknown username', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* UsersService
            return yield* svc.findByUsername('nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('update', () => {
    it('returns updated user', async () => {
      const updatedUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Updated Name',
        avatarUrl: null,
      }

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedUser]),
          }),
        }),
      })

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* UsersService
          return yield* svc.update('user-1', { displayName: 'Updated Name' })
        }),
        testLayer
      )

      expect(result.id).toBe('user-1')
      expect(result.displayName).toBe('Updated Name')
    })

    it('throws NotFoundError if user does not exist', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* UsersService
            return yield* svc.update('nonexistent', { displayName: 'Test' })
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})
