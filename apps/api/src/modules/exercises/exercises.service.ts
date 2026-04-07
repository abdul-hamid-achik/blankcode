import { Drizzle } from '@blankcode/db/client'
import { codeDrafts, concepts, exercises, submissions, tracks } from '@blankcode/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, NotFoundError } from '../../api/errors.js'

interface ExercisesServiceShape {
  readonly findAll: () => Effect.Effect<any[]>
  readonly findByConceptSlug: (
    trackSlug: string,
    conceptSlug: string
  ) => Effect.Effect<any[], NotFoundError>
  readonly findBySlug: (
    trackSlug: string,
    conceptSlug: string,
    exerciseSlug: string
  ) => Effect.Effect<any, NotFoundError>
  readonly findById: (id: string) => Effect.Effect<any, NotFoundError>
  readonly findWithProgress: (
    exerciseId: string,
    userId: string
  ) => Effect.Effect<any, NotFoundError>
  readonly saveDraft: (
    userId: string,
    exerciseId: string,
    code: string
  ) => Effect.Effect<{ success: true }, NotFoundError | BadRequestError>
  readonly deleteDraft: (
    userId: string,
    exerciseId: string
  ) => Effect.Effect<{ success: true }, BadRequestError>
}

export class ExercisesService extends Context.Tag('ExercisesService')<
  ExercisesService,
  ExercisesServiceShape
>() {}

export const ExercisesServiceLive = Layer.effect(
  ExercisesService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    return ExercisesService.of({
      findAll: () =>
        Effect.tryPromise({
          try: () =>
            db.query.exercises.findMany({
              where: eq(exercises.isPublished, true),
              orderBy: asc(exercises.order),
              with: {
                concept: {
                  with: {
                    track: true,
                  },
                },
              },
            }),
          catch: () => new BadRequestError({ message: 'Failed to fetch exercises' }),
        }).pipe(Effect.catchAll(() => Effect.succeed([]))),

      findByConceptSlug: (trackSlug, conceptSlug) =>
        Effect.gen(function* () {
          const track = yield* Effect.tryPromise({
            try: () =>
              db.query.tracks.findFirst({
                where: eq(tracks.slug, trackSlug),
              }),
            catch: () => new NotFoundError({ resource: 'Track', id: trackSlug }),
          })

          if (!track) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Track', id: trackSlug }))
          }

          const concept = yield* Effect.tryPromise({
            try: () =>
              db.query.concepts.findFirst({
                where: and(eq(concepts.trackId, track.id), eq(concepts.slug, conceptSlug)),
                with: {
                  track: true,
                  exercises: {
                    where: eq(exercises.isPublished, true),
                    orderBy: asc(exercises.order),
                  },
                },
              }),
            catch: () => new NotFoundError({ resource: 'Concept', id: conceptSlug }),
          })

          if (!concept) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Concept', id: conceptSlug }))
          }

          return concept.exercises
        }),

      findBySlug: (trackSlug, conceptSlug, exerciseSlug) =>
        Effect.gen(function* () {
          const track = yield* Effect.tryPromise({
            try: () =>
              db.query.tracks.findFirst({
                where: eq(tracks.slug, trackSlug),
              }),
            catch: () => new NotFoundError({ resource: 'Track', id: trackSlug }),
          })

          if (!track) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Track', id: trackSlug }))
          }

          const concept = yield* Effect.tryPromise({
            try: () =>
              db.query.concepts.findFirst({
                where: and(eq(concepts.trackId, track.id), eq(concepts.slug, conceptSlug)),
                with: { track: true },
              }),
            catch: () => new NotFoundError({ resource: 'Concept', id: conceptSlug }),
          })

          if (!concept) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Concept', id: conceptSlug }))
          }

          const exercise = yield* Effect.tryPromise({
            try: () =>
              db.query.exercises.findFirst({
                where: and(eq(exercises.conceptId, concept.id), eq(exercises.slug, exerciseSlug)),
              }),
            catch: () => new NotFoundError({ resource: 'Exercise', id: exerciseSlug }),
          })

          if (!exercise) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Exercise', id: exerciseSlug }))
          }

          return exercise
        }),

      findById: (id) =>
        Effect.gen(function* () {
          const exercise = yield* Effect.tryPromise({
            try: () =>
              db.query.exercises.findFirst({
                where: and(eq(exercises.id, id), eq(exercises.isPublished, true)),
                with: {
                  concept: {
                    with: { track: true },
                  },
                },
              }),
            catch: () => new NotFoundError({ resource: 'Exercise', id }),
          })

          if (!exercise) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Exercise', id }))
          }

          return exercise
        }),

      findWithProgress: (exerciseId, userId) =>
        Effect.gen(function* () {
          const exercise = yield* Effect.tryPromise({
            try: () =>
              db.query.exercises.findFirst({
                where: eq(exercises.id, exerciseId),
                with: {
                  concept: {
                    with: { track: true },
                  },
                },
              }),
            catch: () => new NotFoundError({ resource: 'Exercise', id: exerciseId }),
          })

          if (!exercise) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Exercise', id: exerciseId }))
          }

          const draft = yield* Effect.tryPromise({
            try: () =>
              db.query.codeDrafts.findFirst({
                where: and(eq(codeDrafts.userId, userId), eq(codeDrafts.exerciseId, exerciseId)),
              }),
            catch: () => new NotFoundError({ resource: 'Draft', id: exerciseId }),
          }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))

          const lastSubmission = yield* Effect.tryPromise({
            try: () =>
              db.query.submissions.findFirst({
                where: and(eq(submissions.userId, userId), eq(submissions.exerciseId, exerciseId)),
                orderBy: desc(submissions.createdAt),
              }),
            catch: () => new NotFoundError({ resource: 'Submission', id: exerciseId }),
          }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))

          let code: string
          let codeSource: 'draft' | 'submission' | 'starter'

          if (draft) {
            code = draft.code
            codeSource = 'draft'
          } else if (lastSubmission) {
            code = lastSubmission.code
            codeSource = 'submission'
          } else {
            code = exercise.starterCode
            codeSource = 'starter'
          }

          return {
            exercise,
            code,
            codeSource,
            draft: draft ? { updatedAt: draft.updatedAt } : null,
            lastSubmission: lastSubmission
              ? {
                  id: lastSubmission.id,
                  status: lastSubmission.status,
                  createdAt: lastSubmission.createdAt,
                }
              : null,
          }
        }),

      saveDraft: (userId, exerciseId, code) =>
        Effect.gen(function* () {
          const exercise = yield* Effect.tryPromise({
            try: () => db.query.exercises.findFirst({ where: eq(exercises.id, exerciseId) }),
            catch: () => new NotFoundError({ resource: 'Exercise', id: exerciseId }),
          })

          if (!exercise) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Exercise', id: exerciseId }))
          }

          yield* Effect.tryPromise({
            try: () =>
              db
                .insert(codeDrafts)
                .values({ userId, exerciseId, code, updatedAt: new Date() })
                .onConflictDoUpdate({
                  target: [codeDrafts.userId, codeDrafts.exerciseId],
                  set: { code, updatedAt: new Date() },
                }),
            catch: () => new BadRequestError({ message: 'Failed to save draft' }),
          })

          return { success: true as const }
        }),

      deleteDraft: (userId, exerciseId) =>
        Effect.tryPromise({
          try: () =>
            db
              .delete(codeDrafts)
              .where(and(eq(codeDrafts.userId, userId), eq(codeDrafts.exerciseId, exerciseId))),
          catch: () => new BadRequestError({ message: 'Failed to delete draft' }),
        }).pipe(Effect.map(() => ({ success: true as const }))),
    })
  })
)
