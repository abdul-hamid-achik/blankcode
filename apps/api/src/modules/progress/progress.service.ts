import { Drizzle } from '@blankcode/db/client'
import {
  conceptMastery,
  concepts,
  exercises,
  submissions,
  tracks,
  userProgress,
} from '@blankcode/db/schema'
import { and, desc, eq, gte, isNotNull, sql as rawSql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, NotFoundError } from '../../api/errors.js'

interface ProgressServiceShape {
  readonly getExerciseProgress: (
    userId: string,
    exerciseId: string
  ) => Effect.Effect<any, NotFoundError>
  readonly getConceptMastery: (
    userId: string,
    conceptId: string
  ) => Effect.Effect<any, NotFoundError>
  readonly getTrackProgress: (
    userId: string,
    trackSlug: string
  ) => Effect.Effect<any[], NotFoundError>
  readonly markExerciseCompleted: (
    userId: string,
    exerciseId: string,
    submissionId: string
  ) => Effect.Effect<void, BadRequestError>
  readonly incrementAttempts: (
    userId: string,
    exerciseId: string
  ) => Effect.Effect<void, BadRequestError>
  readonly getSummary: (userId: string) => Effect.Effect<any[], NotFoundError>
  readonly getStats: (userId: string) => Effect.Effect<any, NotFoundError>
  readonly getActivityTimeline: (userId: string) => Effect.Effect<any[], NotFoundError>
  readonly updateConceptMastery: (
    userId: string,
    exerciseId: string
  ) => Effect.Effect<void, BadRequestError>
}

export class ProgressService extends Context.Tag('ProgressService')<
  ProgressService,
  ProgressServiceShape
>() {}

export const ProgressServiceLive = Layer.effect(
  ProgressService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    function toDateKey(value: Date | string) {
      const date = typeof value === 'string' ? new Date(value) : value
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
        .toISOString()
        .slice(0, 10)
    }

    function calculateStreak(completedProgress: { completedAt: Date | null }[]) {
      if (completedProgress.length === 0) {
        return { currentStreak: 0, longestStreak: 0 }
      }

      const dates = completedProgress
        .map((p) => p.completedAt)
        .filter((d): d is Date => d !== null)
        .map((d) => {
          const date = new Date(d)
          date.setHours(0, 0, 0, 0)
          return date.getTime()
        })
        .filter((d, i, arr) => arr.indexOf(d) === i)
        .sort((a, b) => b - a)

      if (dates.length === 0) {
        return { currentStreak: 0, longestStreak: 0 }
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTime = today.getTime()
      const oneDay = 24 * 60 * 60 * 1000

      let currentStreak = 0
      let longestStreak = 0
      let tempStreak = 1

      if (dates[0] === todayTime || dates[0] === todayTime - oneDay) {
        currentStreak = 1
        for (let i = 1; i < dates.length; i++) {
          if (dates[i - 1]! - dates[i]! === oneDay) {
            currentStreak++
          } else {
            break
          }
        }
      }

      for (let i = 1; i < dates.length; i++) {
        if (dates[i - 1]! - dates[i]! === oneDay) {
          tempStreak++
        } else {
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak, currentStreak)

      return { currentStreak, longestStreak }
    }

    function updateConceptMasteryFn(userId: string, exerciseId: string) {
      return Effect.gen(function* () {
        const exercise = yield* Effect.tryPromise({
          try: () =>
            db.query.exercises.findFirst({
              where: eq(exercises.id, exerciseId),
              with: { concept: true },
            }),
          catch: () => new BadRequestError({ message: 'Failed to update concept mastery' }),
        })

        if (!exercise) return

        const conceptExercises = yield* Effect.tryPromise({
          try: () =>
            db.query.exercises.findMany({
              where: eq(exercises.conceptId, exercise.conceptId),
            }),
          catch: () => new BadRequestError({ message: 'Failed to update concept mastery' }),
        })

        const completedProgress = yield* Effect.tryPromise({
          try: () =>
            db.query.userProgress.findMany({
              where: and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)),
            }),
          catch: () => new BadRequestError({ message: 'Failed to update concept mastery' }),
        })

        const completedExerciseIds = new Set(completedProgress.map((p) => p.exerciseId))
        const completedInConcept = conceptExercises.filter((e) =>
          completedExerciseIds.has(e.id)
        ).length
        const masteryLevel =
          conceptExercises.length > 0 ? completedInConcept / conceptExercises.length : 0

        yield* Effect.tryPromise({
          try: () =>
            db
              .insert(conceptMastery)
              .values({
                userId,
                conceptId: exercise.conceptId,
                masteryLevel,
                exercisesCompleted: completedInConcept,
                exercisesTotal: conceptExercises.length,
                lastPracticedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [conceptMastery.userId, conceptMastery.conceptId],
                set: {
                  masteryLevel,
                  exercisesCompleted: completedInConcept,
                  exercisesTotal: conceptExercises.length,
                  lastPracticedAt: new Date(),
                  updatedAt: new Date(),
                },
              }),
          catch: () => new BadRequestError({ message: 'Failed to update concept mastery' }),
        })
      })
    }

    return ProgressService.of({
      getExerciseProgress: (userId, exerciseId) =>
        Effect.tryPromise({
          try: () =>
            db.query.userProgress.findFirst({
              where: and(eq(userProgress.userId, userId), eq(userProgress.exerciseId, exerciseId)),
            }),
          catch: () => new NotFoundError({ resource: 'ExerciseProgress', id: exerciseId }),
        }).pipe(Effect.map((progress) => progress ?? null)),

      getConceptMastery: (userId, conceptId) =>
        Effect.tryPromise({
          try: () =>
            db.query.conceptMastery.findFirst({
              where: and(
                eq(conceptMastery.userId, userId),
                eq(conceptMastery.conceptId, conceptId)
              ),
            }),
          catch: () => new NotFoundError({ resource: 'ConceptMastery', id: conceptId }),
        }).pipe(Effect.map((mastery) => mastery ?? null)),

      getTrackProgress: (userId, trackSlug) =>
        Effect.gen(function* () {
          const track = yield* Effect.tryPromise({
            try: () =>
              db.query.tracks.findFirst({
                where: eq(tracks.slug, trackSlug as (typeof tracks.slug.enumValues)[number]),
              }),
            catch: () => new NotFoundError({ resource: 'Track', id: trackSlug }),
          })

          if (!track) return []

          const trackConcepts = yield* Effect.tryPromise({
            try: () =>
              db.query.concepts.findMany({
                where: eq(concepts.trackId, track.id),
                with: { exercises: true },
              }),
            catch: () => new NotFoundError({ resource: 'Concepts', id: track.id }),
          })

          const masteryRecords = yield* Effect.tryPromise({
            try: () =>
              db.query.conceptMastery.findMany({
                where: eq(conceptMastery.userId, userId),
              }),
            catch: () => new NotFoundError({ resource: 'ConceptMastery', id: userId }),
          })

          const masteryMap = new Map(masteryRecords.map((m) => [m.conceptId, m]))

          return trackConcepts.map((concept) => ({
            conceptId: concept.id,
            conceptSlug: concept.slug,
            conceptName: concept.name,
            mastery: masteryMap.get(concept.id) ?? null,
            totalExercises: concept.exercises.length,
          }))
        }),

      markExerciseCompleted: (userId, exerciseId, submissionId) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: () =>
              db
                .insert(userProgress)
                .values({
                  userId,
                  exerciseId,
                  isCompleted: true,
                  attempts: 1,
                  bestSubmissionId: submissionId,
                  completedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [userProgress.userId, userProgress.exerciseId],
                  set: {
                    isCompleted: true,
                    attempts: rawSql`${userProgress.attempts} + 1`,
                    bestSubmissionId: rawSql`CASE
                      WHEN ${userProgress.bestSubmissionId} IS NULL THEN ${submissionId}
                      WHEN (SELECT execution_time_ms FROM submissions WHERE id = ${submissionId}) IS NULL
                      THEN ${userProgress.bestSubmissionId}
                      WHEN (SELECT execution_time_ms FROM submissions WHERE id = ${userProgress.bestSubmissionId}) IS NULL
                      THEN ${submissionId}
                      WHEN (SELECT execution_time_ms FROM submissions WHERE id = ${submissionId}) <
                           (SELECT execution_time_ms FROM submissions WHERE id = ${userProgress.bestSubmissionId})
                      THEN ${submissionId}
                      ELSE ${userProgress.bestSubmissionId}
                    END`,
                    completedAt: new Date(),
                    updatedAt: new Date(),
                  },
                }),
            catch: () => new BadRequestError({ message: 'Failed to mark exercise completed' }),
          })

          yield* updateConceptMasteryFn(userId, exerciseId)
        }),

      incrementAttempts: (userId, exerciseId) =>
        Effect.tryPromise({
          try: () =>
            db
              .insert(userProgress)
              .values({ userId, exerciseId, isCompleted: false, attempts: 1 })
              .onConflictDoUpdate({
                target: [userProgress.userId, userProgress.exerciseId],
                set: {
                  attempts: rawSql`${userProgress.attempts} + 1`,
                  updatedAt: new Date(),
                },
              }),
          catch: () => new BadRequestError({ message: 'Failed to increment attempts' }),
        }).pipe(Effect.map(() => undefined)),

      getSummary: (userId) =>
        Effect.gen(function* () {
          const allTracks = yield* Effect.tryPromise({
            try: () =>
              db.query.tracks.findMany({
                with: {
                  concepts: {
                    with: { exercises: true },
                  },
                },
              }),
            catch: () => new NotFoundError({ resource: 'Tracks', id: 'all' }),
          })

          const completedProgress = yield* Effect.tryPromise({
            try: () =>
              db.query.userProgress.findMany({
                where: and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)),
              }),
            catch: () => new NotFoundError({ resource: 'UserProgress', id: userId }),
          })

          const completedExerciseIds = new Set(completedProgress.map((p) => p.exerciseId))

          return allTracks.map((track) => {
            const trackExercises = track.concepts.flatMap((c) => c.exercises)
            const completedInTrack = trackExercises.filter((e) =>
              completedExerciseIds.has(e.id)
            ).length
            const totalInTrack = trackExercises.length

            return {
              trackSlug: track.slug,
              trackName: track.name,
              totalExercises: totalInTrack,
              completedExercises: completedInTrack,
              masteryLevel: totalInTrack > 0 ? completedInTrack / totalInTrack : 0,
            }
          })
        }),

      getStats: (userId) =>
        Effect.gen(function* () {
          const completedProgress = yield* Effect.tryPromise({
            try: () =>
              db.query.userProgress.findMany({
                where: and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)),
                orderBy: desc(userProgress.completedAt),
              }),
            catch: () => new NotFoundError({ resource: 'UserProgress', id: userId }),
          })

          const userSubmissions = yield* Effect.tryPromise({
            try: () =>
              db.query.submissions.findMany({
                where: eq(submissions.userId, userId),
              }),
            catch: () => new NotFoundError({ resource: 'Submissions', id: userId }),
          })

          const totalExercisesCompleted = completedProgress.length
          const totalSubmissions = userSubmissions.length

          const { currentStreak, longestStreak } = calculateStreak(completedProgress)

          const lastActivityDate = completedProgress[0]?.completedAt ?? null

          return {
            totalExercisesCompleted,
            currentStreak,
            longestStreak,
            totalSubmissions,
            lastActivityDate: lastActivityDate?.toISOString() ?? null,
          }
        }),

      getActivityTimeline: (userId) =>
        Effect.gen(function* () {
          const days = 30
          const now = new Date()
          const todayUtc = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
          )
          const startUtc = new Date(todayUtc)
          startUtc.setUTCDate(startUtc.getUTCDate() - (days - 1))

          const [submissionRows, completionRows] = yield* Effect.tryPromise({
            try: () =>
              Promise.all([
                db.query.submissions.findMany({
                  where: and(eq(submissions.userId, userId), gte(submissions.createdAt, startUtc)),
                  columns: { createdAt: true },
                }),
                db.query.userProgress.findMany({
                  where: and(
                    eq(userProgress.userId, userId),
                    eq(userProgress.isCompleted, true),
                    isNotNull(userProgress.completedAt),
                    gte(userProgress.completedAt, startUtc)
                  ),
                  columns: { completedAt: true },
                }),
              ]),
            catch: () => new NotFoundError({ resource: 'ActivityTimeline', id: userId }),
          })

          const counts = new Map<string, { submissions: number; exercisesCompleted: number }>()
          const increment = (key: string, field: 'submissions' | 'exercisesCompleted') => {
            const current = counts.get(key) ?? { submissions: 0, exercisesCompleted: 0 }
            current[field] += 1
            counts.set(key, current)
          }

          for (const row of submissionRows) {
            increment(toDateKey(row.createdAt), 'submissions')
          }

          for (const row of completionRows) {
            if (row.completedAt) {
              increment(toDateKey(row.completedAt), 'exercisesCompleted')
            }
          }

          return Array.from({ length: days }, (_, index) => {
            const date = new Date(startUtc)
            date.setUTCDate(startUtc.getUTCDate() + index)
            const key = toDateKey(date)
            const entry = counts.get(key) ?? { submissions: 0, exercisesCompleted: 0 }

            return {
              date: key,
              submissions: entry.submissions,
              exercisesCompleted: entry.exercisesCompleted,
            }
          })
        }),

      updateConceptMastery: (userId, exerciseId) => updateConceptMasteryFn(userId, exerciseId),
    })
  })
)
