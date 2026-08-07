import { Drizzle } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import type { UserUpdateInput } from '@blankcode/shared'
import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, NotFoundError } from '../../api/errors.js'

type UserRow = typeof users.$inferSelect

/**
 * What the caller gets back, spelled out.
 *
 * The point is what is *absent*: `passwordHash` is on the row and on none of
 * these. The queries already select explicit columns, but with `any` on the
 * contract nothing stopped a later `columns:` change — or a `findFirst` with no
 * `columns` at all — from widening the response, and no test would have
 * noticed. Naming the fields makes that a compile error.
 */
export type PublicUser = Pick<
  UserRow,
  'id' | 'email' | 'username' | 'displayName' | 'avatarUrl' | 'createdAt'
>

/** A profile someone else can see: no email. */
export type PublicProfile = Pick<
  UserRow,
  'id' | 'username' | 'displayName' | 'avatarUrl' | 'createdAt'
>

interface UsersServiceShape {
  readonly findById: (id: string) => Effect.Effect<PublicUser, NotFoundError>
  readonly findByUsername: (username: string) => Effect.Effect<PublicProfile, NotFoundError>
  readonly update: (
    id: string,
    input: UserUpdateInput
  ) => Effect.Effect<
    Pick<UserRow, 'id' | 'email' | 'username' | 'displayName' | 'avatarUrl'>,
    NotFoundError | BadRequestError
  >
}

export class UsersService extends Context.Tag('UsersService')<UsersService, UsersServiceShape>() {}

export const UsersServiceLive = Layer.effect(
  UsersService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    return UsersService.of({
      findById: (id) =>
        Effect.gen(function* () {
          const user = yield* Effect.tryPromise({
            try: () =>
              db.query.users.findFirst({
                where: eq(users.id, id),
                columns: {
                  id: true,
                  email: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  createdAt: true,
                },
              }),
            catch: () => new NotFoundError({ resource: 'User', id }),
          })
          if (!user) {
            return yield* Effect.fail(new NotFoundError({ resource: 'User', id }))
          }
          return user
        }),

      findByUsername: (username) =>
        Effect.gen(function* () {
          const user = yield* Effect.tryPromise({
            try: () =>
              db.query.users.findFirst({
                where: eq(users.username, username),
                columns: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  createdAt: true,
                },
              }),
            catch: () => new NotFoundError({ resource: 'User', id: username }),
          })
          if (!user) {
            return yield* Effect.fail(new NotFoundError({ resource: 'User', id: username }))
          }
          return user
        }),

      update: (id, input) =>
        Effect.gen(function* () {
          const [user] = yield* Effect.tryPromise({
            try: () =>
              db
                .update(users)
                .set({ ...input, updatedAt: new Date() })
                .where(eq(users.id, id))
                .returning({
                  id: users.id,
                  email: users.email,
                  username: users.username,
                  displayName: users.displayName,
                  avatarUrl: users.avatarUrl,
                }),
            catch: () => new BadRequestError({ message: 'Failed to update user' }),
          })
          if (!user) {
            return yield* Effect.fail(new NotFoundError({ resource: 'User', id }))
          }
          return user
        }),
    })
  })
)
