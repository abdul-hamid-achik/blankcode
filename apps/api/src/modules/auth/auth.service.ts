import { createHash } from 'node:crypto'
import { Drizzle } from '@blankcode/db/client'
import { refreshTokens, users } from '@blankcode/db/schema'
import * as bcrypt from 'bcrypt'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, ConflictError, UnauthorizedError } from '../../api/errors.js'
import { JwtService } from '../../services/jwt.service.js'

interface AuthServiceShape {
  readonly register: (input: {
    email: string
    username: string
    password: string
    displayName?: string | undefined
  }) => Effect.Effect<
    {
      user: { id: string; email: string; username: string; displayName: string | null }
      accessToken: string
      refreshToken: string
      refreshTokenExpiresAt: Date
    },
    ConflictError | BadRequestError | UnauthorizedError
  >

  readonly login: (input: { email: string; password: string }) => Effect.Effect<
    {
      user: { id: string; email: string; username: string; displayName: string | null }
      accessToken: string
      refreshToken: string
      refreshTokenExpiresAt: Date
    },
    UnauthorizedError | BadRequestError
  >

  readonly validateUser: (userId: string) => Effect.Effect<
    {
      id: string
      email: string
      username: string
      displayName: string | null
      avatarUrl: string | null
    } | null,
    BadRequestError
  >

  readonly validateAndRotateRefreshToken: (token: string) => Effect.Effect<
    {
      user: { id: string; email: string; username: string; displayName: string | null }
      accessToken: string
      refreshToken: string
      refreshTokenExpiresAt: Date
    },
    UnauthorizedError | BadRequestError
  >

  readonly revokeRefreshToken: (token: string) => Effect.Effect<void, BadRequestError>
}

export class AuthService extends Context.Tag('AuthService')<AuthService, AuthServiceShape>() {}

export const AuthServiceLive = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const db = yield* Drizzle
    const jwt = yield* JwtService

    function generateRefreshToken(userId: string) {
      return Effect.gen(function* () {
        const bytes = new Uint8Array(64)
        crypto.getRandomValues(bytes)
        const token = Buffer.from(bytes).toString('hex')
        const tokenHash = yield* Effect.tryPromise({
          try: () => bcrypt.hash(token, 10),
          catch: () => new BadRequestError({ message: 'Failed to hash refresh token' }),
        })
        const lookupHash = createHash('sha256').update(token).digest('hex')

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

        yield* Effect.tryPromise({
          try: () =>
            db.insert(refreshTokens).values({ userId, token: lookupHash, tokenHash, expiresAt }),
          catch: () => new BadRequestError({ message: 'Failed to store refresh token' }),
        })

        return { token, expiresAt }
      })
    }

    return AuthService.of({
      register: (input) =>
        Effect.gen(function* () {
          const existingUser = yield* Effect.tryPromise({
            try: () => db.query.users.findFirst({ where: eq(users.email, input.email) }),
            catch: () => new BadRequestError({ message: 'Failed to check existing user' }),
          })
          if (existingUser) {
            return yield* Effect.fail(
              new ConflictError({ message: 'User with this email already exists' })
            )
          }

          const existingUsername = yield* Effect.tryPromise({
            try: () => db.query.users.findFirst({ where: eq(users.username, input.username) }),
            catch: () => new BadRequestError({ message: 'Failed to check existing username' }),
          })
          if (existingUsername) {
            return yield* Effect.fail(new ConflictError({ message: 'Username is already taken' }))
          }

          const passwordHash = yield* Effect.tryPromise({
            try: () => bcrypt.hash(input.password, 12),
            catch: () => new BadRequestError({ message: 'Failed to hash password' }),
          })

          const [user] = yield* Effect.tryPromise({
            try: () =>
              db
                .insert(users)
                .values({
                  email: input.email,
                  username: input.username,
                  passwordHash,
                  displayName: input.displayName ?? null,
                })
                .returning({
                  id: users.id,
                  email: users.email,
                  username: users.username,
                  displayName: users.displayName,
                }),
            catch: () => new BadRequestError({ message: 'Failed to create user' }),
          })

          if (!user) {
            return yield* Effect.fail(new BadRequestError({ message: 'Failed to create user' }))
          }

          const accessToken = yield* jwt.sign({ sub: user.id, email: user.email })
          const refreshTokenResult = yield* generateRefreshToken(user.id)

          return {
            user,
            accessToken,
            refreshToken: refreshTokenResult.token,
            refreshTokenExpiresAt: refreshTokenResult.expiresAt,
          }
        }),

      login: (input) =>
        Effect.gen(function* () {
          const user = yield* Effect.tryPromise({
            try: () => db.query.users.findFirst({ where: eq(users.email, input.email) }),
            catch: () => new UnauthorizedError({ message: 'Invalid credentials' }),
          })

          if (!user) {
            return yield* Effect.fail(new UnauthorizedError({ message: 'Invalid credentials' }))
          }

          const isPasswordValid = yield* Effect.tryPromise({
            try: () => bcrypt.compare(input.password, user.passwordHash),
            catch: () => new UnauthorizedError({ message: 'Invalid credentials' }),
          })

          if (!isPasswordValid) {
            return yield* Effect.fail(new UnauthorizedError({ message: 'Invalid credentials' }))
          }

          const accessToken = yield* jwt.sign({ sub: user.id, email: user.email })
          const refreshTokenResult = yield* generateRefreshToken(user.id)

          return {
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              displayName: user.displayName,
            },
            accessToken,
            refreshToken: refreshTokenResult.token,
            refreshTokenExpiresAt: refreshTokenResult.expiresAt,
          }
        }),

      validateUser: (userId) =>
        Effect.tryPromise({
          try: () =>
            db.query.users.findFirst({
              where: eq(users.id, userId),
              columns: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            }),
          catch: () => new BadRequestError({ message: 'Failed to validate user' }),
        }).pipe(Effect.map((user) => user ?? null)),

      validateAndRotateRefreshToken: (token) =>
        Effect.gen(function* () {
          const lookupHash = createHash('sha256').update(token).digest('hex')

          const tokenRecord = yield* Effect.tryPromise({
            try: () =>
              db.query.refreshTokens.findFirst({
                where: and(
                  eq(refreshTokens.token, lookupHash),
                  isNull(refreshTokens.revokedAt),
                  gt(refreshTokens.expiresAt, new Date())
                ),
                with: { user: true },
              }),
            catch: () => new UnauthorizedError({ message: 'Invalid refresh token' }),
          })

          if (!tokenRecord) {
            return yield* Effect.fail(new UnauthorizedError({ message: 'Invalid refresh token' }))
          }

          const isValid = yield* Effect.tryPromise({
            try: () => bcrypt.compare(token, tokenRecord.tokenHash),
            catch: () => new UnauthorizedError({ message: 'Invalid refresh token' }),
          })
          if (!isValid) {
            return yield* Effect.fail(new UnauthorizedError({ message: 'Invalid refresh token' }))
          }

          yield* Effect.tryPromise({
            try: () =>
              db
                .update(refreshTokens)
                .set({ revokedAt: new Date() })
                .where(eq(refreshTokens.id, tokenRecord.id)),
            catch: () => new UnauthorizedError({ message: 'Failed to revoke old token' }),
          })

          const accessToken = yield* jwt.sign({
            sub: tokenRecord.user.id,
            email: tokenRecord.user.email,
          })
          const refreshTokenResult = yield* generateRefreshToken(tokenRecord.user.id)

          return {
            user: {
              id: tokenRecord.user.id,
              email: tokenRecord.user.email,
              username: tokenRecord.user.username,
              displayName: tokenRecord.user.displayName,
            },
            accessToken,
            refreshToken: refreshTokenResult.token,
            refreshTokenExpiresAt: refreshTokenResult.expiresAt,
          }
        }),

      revokeRefreshToken: (token) =>
        Effect.gen(function* () {
          const lookupHash = createHash('sha256').update(token).digest('hex')

          const tokenRecord = yield* Effect.tryPromise({
            try: () =>
              db.query.refreshTokens.findFirst({
                where: and(
                  eq(refreshTokens.token, lookupHash),
                  isNull(refreshTokens.revokedAt),
                  gt(refreshTokens.expiresAt, new Date())
                ),
              }),
            catch: () => undefined,
          }).pipe(Effect.orElseSucceed(() => undefined))

          if (!tokenRecord) return

          const isValid = yield* Effect.tryPromise({
            try: () => bcrypt.compare(token, tokenRecord.tokenHash),
            catch: () => false,
          }).pipe(Effect.orElseSucceed(() => false))

          if (!isValid) return

          yield* Effect.tryPromise({
            try: () =>
              db
                .update(refreshTokens)
                .set({ revokedAt: new Date() })
                .where(eq(refreshTokens.id, tokenRecord.id)),
            catch: (err) =>
              new BadRequestError({ message: `Failed to revoke refresh token: ${err}` }),
          })
        }),
    })
  })
)
