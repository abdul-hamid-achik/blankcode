import { createHash } from 'node:crypto'
import { Drizzle } from '@blankcode/db/client'
import { apiTokens, users } from '@blankcode/db/schema'
import { HttpApiMiddleware, HttpApiSecurity, HttpServerRequest } from '@effect/platform'
import { and, eq, isNull } from 'drizzle-orm'
import { Context, Effect, Layer, Redacted } from 'effect'
import { UnauthorizedError } from '../api/errors.js'
import { JwtService } from '../services/jwt.service.js'
import { apiPathOf, practiceScopeAllows } from './practice-scope.js'

export interface CurrentUserShape {
  readonly id: string
  readonly email: string
  readonly username: string
  readonly displayName: string | null
  readonly avatarUrl: string | null
  /**
   * Which credential spoke: the web session or a practice token. Recorded on
   * submissions so agent work is labeled, never guessed at. The server knows
   * the credential; it cannot know the hands, and does not pretend to.
   */
  readonly via: 'web' | 'agent'
  readonly apiTokenId: string | null
}

export class CurrentUser extends Context.Tag('CurrentUser')<CurrentUser, CurrentUserShape>() {}

export class Authorization extends HttpApiMiddleware.Tag<Authorization>()('Authorization', {
  failure: UnauthorizedError,
  provides: CurrentUser,
  security: { bearer: HttpApiSecurity.bearer },
}) {}

const USER_COLUMNS = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const

/** Practice tokens are prefixed so a leaked one is findable by a grep. */
const PRACTICE_TOKEN_PREFIX = 'bck_'

/** How stale lastUsedAt may get before it is worth a write. */
const LAST_USED_REFRESH_MS = 5 * 60 * 1000

export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const jwt = yield* JwtService
    const db = yield* Drizzle

    const loadUser = (userId: string) =>
      Effect.tryPromise({
        try: () =>
          db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: USER_COLUMNS,
          }),
        catch: () => new UnauthorizedError({ message: 'Failed to validate user' }),
      })

    return Authorization.of({
      bearer: (token) =>
        Effect.gen(function* () {
          const raw = Redacted.value(token)

          /*
           * Two credentials share the Bearer scheme. A practice token opens
           * exactly the practice loop — the allowlist in practice-scope.ts —
           * and nothing else; the JWT session opens everything. The prefix
           * keeps the two unambiguous.
           */
          if (raw.startsWith(PRACTICE_TOKEN_PREFIX)) {
            const request = yield* HttpServerRequest.HttpServerRequest
            const path = apiPathOf(request.url)
            if (!practiceScopeAllows(request.method, path)) {
              return yield* Effect.fail(
                new UnauthorizedError({ message: 'This token has practice scope only' })
              )
            }

            const lookupHash = createHash('sha256').update(raw).digest('hex')
            const tokenRow = yield* Effect.tryPromise({
              try: () =>
                db.query.apiTokens.findFirst({
                  where: and(eq(apiTokens.token, lookupHash), isNull(apiTokens.revokedAt)),
                  columns: { id: true, userId: true, lastUsedAt: true },
                }),
              catch: () => new UnauthorizedError({ message: 'Failed to validate token' }),
            })

            if (!tokenRow) {
              return yield* Effect.fail(
                new UnauthorizedError({ message: 'Invalid or revoked token' })
              )
            }

            const user = yield* loadUser(tokenRow.userId)
            if (!user) {
              return yield* Effect.fail(new UnauthorizedError({ message: 'User not found' }))
            }

            // lastUsedAt is what lets a person spot a forgotten key still
            // talking. Refreshed at most every few minutes — a write per
            // tool call would be paying for the same fact twice.
            const stale =
              !tokenRow.lastUsedAt ||
              Date.now() - tokenRow.lastUsedAt.getTime() > LAST_USED_REFRESH_MS
            if (stale) {
              yield* Effect.promise(() =>
                db
                  .update(apiTokens)
                  .set({ lastUsedAt: new Date() })
                  .where(eq(apiTokens.id, tokenRow.id))
                  .catch(() => {})
              )
            }

            return { ...user, via: 'agent', apiTokenId: tokenRow.id } as CurrentUserShape
          }

          const payload = yield* jwt.verify(raw)
          const user = yield* loadUser(payload.sub)

          if (!user) {
            return yield* Effect.fail(new UnauthorizedError({ message: 'User not found' }))
          }

          return { ...user, via: 'web', apiTokenId: null } as CurrentUserShape
        }),
    })
  })
)
