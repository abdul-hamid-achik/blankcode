import { Drizzle } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { HttpApiMiddleware, HttpApiSecurity } from '@effect/platform'
import { eq } from 'drizzle-orm'
import { Effect, Layer, Redacted } from 'effect'
import { ForbiddenError } from '../api/errors.js'
import { config } from '../config/index.js'
import { JwtService } from '../services/jwt.service.js'
import { CurrentUser, type CurrentUserShape } from './auth.middleware.js'

export class AdminAuthorization extends HttpApiMiddleware.Tag<AdminAuthorization>()(
  'AdminAuthorization',
  {
    failure: ForbiddenError,
    provides: CurrentUser,
    security: { bearer: HttpApiSecurity.bearer },
  }
) {}

export const AdminAuthorizationLive = Layer.effect(
  AdminAuthorization,
  Effect.gen(function* () {
    const jwt = yield* JwtService
    const db = yield* Drizzle

    return AdminAuthorization.of({
      bearer: (token) =>
        Effect.gen(function* () {
          const payload = yield* jwt
            .verify(Redacted.value(token))
            .pipe(Effect.mapError(() => new ForbiddenError({ message: 'Invalid credentials' })))

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
            catch: () => new ForbiddenError({ message: 'Failed to validate user' }),
          })

          if (!user) {
            return yield* Effect.fail(new ForbiddenError({ message: 'User not found' }))
          }

          if (!config.admin.emails.includes(user.email)) {
            return yield* Effect.fail(new ForbiddenError({ message: 'Admin access required' }))
          }

          return user as CurrentUserShape
        }),
    })
  })
)
