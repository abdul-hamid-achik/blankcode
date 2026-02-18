import { Drizzle } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import type { UserUpdateInput } from '@blankcode/shared'
import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, NotFoundError } from '../../api/errors.js'

interface UsersServiceShape {
  readonly findById: (id: string) => Effect.Effect<any, NotFoundError>
  readonly findByUsername: (username: string) => Effect.Effect<any, NotFoundError>
  readonly update: (
    id: string,
    input: UserUpdateInput
  ) => Effect.Effect<any, NotFoundError | BadRequestError>
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
