import { Drizzle } from '@blankcode/db/client'
import { concepts, tracks } from '@blankcode/db/schema'
import type { TrackSlug } from '@blankcode/shared'
import { asc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { NotFoundError } from '../../api/errors.js'

interface TracksServiceShape {
  readonly findAll: () => Effect.Effect<any[], NotFoundError>
  readonly findBySlug: (slug: TrackSlug) => Effect.Effect<any, NotFoundError>
  readonly findById: (id: string) => Effect.Effect<any, NotFoundError>
}

export class TracksService extends Context.Tag('TracksService')<
  TracksService,
  TracksServiceShape
>() {}

export const TracksServiceLive = Layer.effect(
  TracksService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    return TracksService.of({
      findAll: () =>
        Effect.tryPromise({
          try: () =>
            db.query.tracks.findMany({
              where: eq(tracks.isPublished, true),
              orderBy: asc(tracks.order),
            }),
          catch: () => new NotFoundError({ resource: 'Tracks', id: 'all' }),
        }),

      findBySlug: (slug) =>
        Effect.gen(function* () {
          const track = yield* Effect.tryPromise({
            try: () =>
              db.query.tracks.findFirst({
                where: eq(tracks.slug, slug),
                with: {
                  concepts: {
                    where: eq(concepts.isPublished, true),
                    orderBy: asc(concepts.order),
                  },
                },
              }),
            catch: () => new NotFoundError({ resource: 'Track', id: slug }),
          })
          if (!track) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Track', id: slug }))
          }
          return track
        }),

      findById: (id) =>
        Effect.gen(function* () {
          const track = yield* Effect.tryPromise({
            try: () => db.query.tracks.findFirst({ where: eq(tracks.id, id) }),
            catch: () => new NotFoundError({ resource: 'Track', id }),
          })
          if (!track) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Track', id }))
          }
          return track
        }),
    })
  })
)
