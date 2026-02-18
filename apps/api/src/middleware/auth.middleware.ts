import { Drizzle } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { HttpApiMiddleware, HttpApiSecurity } from '@effect/platform'
import { eq } from 'drizzle-orm'
import { Context, Effect, Layer, Redacted } from 'effect'
import { UnauthorizedError } from '../api/errors.js'
import { JwtService } from '../services/jwt.service.js'

export interface CurrentUserShape {
  readonly id: string
  readonly email: string
  readonly username: string
  readonly displayName: string | null
  readonly avatarUrl: string | null
}

export class CurrentUser extends Context.Tag('CurrentUser')<CurrentUser, CurrentUserShape>() {}

export class Authorization extends HttpApiMiddleware.Tag<Authorization>()('Authorization', {
  failure: UnauthorizedError,
  provides: CurrentUser,
  security: { bearer: HttpApiSecurity.bearer },
}) {}

export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const jwt = yield* JwtService
    const db = yield* Drizzle

    return Authorization.of({
      bearer: (token) =>
        Effect.gen(function* () {
          const payload = yield* jwt.verify(Redacted.value(token))

          const user = yield* Effect.tryPromise({
            try: () =>
              db.query.users.findFirst({
                where: eq(users.id, payload.sub),
                columns: {
                  id: true,
                  email: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              }),
            catch: () => new UnauthorizedError({ message: 'Failed to validate user' }),
          })

          if (!user) {
            return yield* Effect.fail(new UnauthorizedError({ message: 'User not found' }))
          }

          return user as CurrentUserShape
        }),
    })
  })
)
