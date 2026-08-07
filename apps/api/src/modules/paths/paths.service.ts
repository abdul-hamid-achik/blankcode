import { Drizzle } from '@blankcode/db/client'
import { learningPaths } from '@blankcode/db/schema'
import { asc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { NotFoundError } from '../../api/errors.js'

/**
 * Learning paths, from the database.
 *
 * The handlers used to answer from `LEARNING_PATHS` in the shared package,
 * which lists its challenges by *slug*. The detail page then asked
 * `/api/exercises/:id` for each one, and that lookup is on `exercises.id` — a
 * uuid. Every request 404'd, so no path ever resolved a single exercise, and
 * the failure looked like missing content rather than a wrong identifier.
 *
 * The importer already resolves those slugs to ids when it writes this table.
 * Reading from here is what makes the two halves meet.
 */

type PathRow = typeof learningPaths.$inferSelect

interface PathsServiceShape {
  readonly findAll: () => Effect.Effect<PathRow[], NotFoundError>
  readonly findBySlug: (slug: string) => Effect.Effect<PathRow, NotFoundError>
}

export class PathsService extends Context.Tag('PathsService')<PathsService, PathsServiceShape>() {}

export const PathsServiceLive = Layer.effect(
  PathsService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    return PathsService.of({
      findAll: () =>
        Effect.tryPromise({
          try: () =>
            db.query.learningPaths.findMany({
              where: eq(learningPaths.isPublished, true),
              orderBy: asc(learningPaths.order),
            }),
          catch: () => new NotFoundError({ resource: 'Paths', id: 'all' }),
        }),

      findBySlug: (slug) =>
        Effect.gen(function* () {
          const path = yield* Effect.tryPromise({
            try: () =>
              db.query.learningPaths.findFirst({
                where: eq(learningPaths.slug, slug),
              }),
            catch: () => new NotFoundError({ resource: 'Path', id: slug }),
          })

          // An unpublished path is not found rather than hidden-but-fetchable:
          // the slug is guessable, and a draft path is content nobody has
          // decided to ship.
          if (!path || !path.isPublished) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Path', id: slug }))
          }

          return path
        }),
    })
  })
)
