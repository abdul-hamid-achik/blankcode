import { Drizzle } from '@blankcode/db/client'
import {
  conceptMastery,
  concepts,
  exercises,
  readingSubmissions,
  reviewSchedules,
  submissions,
  tracks,
  userProgress,
} from '@blankcode/db/schema'
import { and, desc, eq, gte, isNotNull, sql as rawSql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, NotFoundError } from '../../api/errors.js'

type UserProgressRow = typeof userProgress.$inferSelect
type ConceptMasteryRow = typeof conceptMastery.$inferSelect

/**
 * Mastery as the learner experiences it, which is not what is stored.
 *
 * `masteryLevel` is the decayed value; `storedMasteryLevel` is the number in
 * the row. Naming both is the point — with `any` on the contract, a caller
 * reading `masteryLevel` could not tell which one it was getting, and the
 * difference is the whole feature.
 */
export interface DecayedMastery extends ConceptMasteryRow {
  storedMasteryLevel: number
}

export interface ConceptProgress {
  conceptId: string
  conceptSlug: string
  conceptName: string
  mastery: DecayedMastery | null
  totalExercises: number
}

export interface TrackSummary {
  trackSlug: string
  trackName: string
  totalExercises: number
  completedExercises: number
  masteryLevel: number
}

export interface ProgressStats {
  totalExercisesCompleted: number
  /**
   * Windowed presence, which replaced the daily streak. A streak contradicts
   * the product's own scheduler: SM-2 exists to tell you NOT to come back
   * until it is time, so the obedient learner has empty days by design — a
   * streak either breaks on them (punishing obedience) or pushes busywork.
   * "Practiced 4 of the last 7 days" states the same fact without the whip.
   * `days` runs oldest → today; a day counts if anything was submitted —
   * showing up and failing is practice.
   */
  presence: { window: number; days: boolean[]; practiced: number }
  totalSubmissions: number
  lastActivityDate: string | null
}

export interface ActivityDay {
  date: string
  submissions: number
  exercisesCompleted: number
}

export interface WeakSpotConcept {
  conceptSlug: string
  conceptName: string
  trackSlug: string
  attempts: number
  failedShare: number
  completed: number
  total: number
  /** Absent or `failures` is the thirty-day scoreboard. `unexplained` is a hold. */
  why?: 'failures' | 'unexplained'
}

export interface ReadingGap {
  point: string
  misses: number
}

export interface WeakSpots {
  concepts: WeakSpotConcept[]
  readingGaps: ReadingGap[]
  rusting: RustingConcept[]
  weakReadings: WeakReading[]
}

interface ProgressServiceShape {
  readonly getExerciseProgress: (
    userId: string,
    exerciseId: string
  ) => Effect.Effect<UserProgressRow | null, NotFoundError>
  readonly getConceptMastery: (
    userId: string,
    conceptId: string
  ) => Effect.Effect<DecayedMastery | null, NotFoundError>
  readonly getTrackProgress: (
    userId: string,
    trackSlug: string
  ) => Effect.Effect<ConceptProgress[], NotFoundError>
  readonly markExerciseCompleted: (
    userId: string,
    exerciseId: string,
    submissionId: string
  ) => Effect.Effect<void, BadRequestError>
  readonly incrementAttempts: (
    userId: string,
    exerciseId: string
  ) => Effect.Effect<void, BadRequestError>
  readonly getSummary: (userId: string) => Effect.Effect<TrackSummary[], NotFoundError>
  readonly getCompletedExerciseIds: (userId: string) => Effect.Effect<string[], NotFoundError>
  readonly getStats: (userId: string) => Effect.Effect<ProgressStats, NotFoundError>
  readonly getActivityTimeline: (userId: string) => Effect.Effect<ActivityDay[], NotFoundError>
  readonly updateConceptMastery: (
    userId: string,
    exerciseId: string
  ) => Effect.Effect<void, BadRequestError>
  readonly getWeakSpots: (userId: string) => Effect.Effect<WeakSpots, NotFoundError>
}

export class ProgressService extends Context.Tag('ProgressService')<
  ProgressService,
  ProgressServiceShape
>() {}

// Mastery decay: skill rusts over time. We model retention with an exponential
// half-life: after `MASTERY_HALF_LIFE_DAYS` of no practice, mastery shown to
// the user halves. Stored mastery is never mutated; we apply decay only on read
// so the dashboard reflects current ability rather than peak ability.
const MASTERY_HALF_LIFE_DAYS = 14
const MASTERY_DECAY_FLOOR = 0.05

function applyMasteryDecay(level: number, lastPracticedAt: Date | null | undefined): number {
  if (level <= 0 || !lastPracticedAt) return level
  const days = (Date.now() - new Date(lastPracticedAt).getTime()) / (24 * 60 * 60 * 1000)
  // Same-day practice — no decay yet. Avoids floating-point drift on freshly
  // updated rows and matches user intuition that today's progress shouldn't rust.
  if (days < 1) return level
  const decayed = level * 2 ** (-days / MASTERY_HALF_LIFE_DAYS)
  return Math.max(MASTERY_DECAY_FLOOR * level, decayed)
}

// A submission counts against a concept only once it fails outright or errors
// — 'pending'/'running' rows are mid-flight, not evidence of struggle.
const FAILING_SUBMISSION_STATUSES = new Set(['failed', 'error'])

// Thresholds are deliberately conservative: a concept only surfaces once
// there is enough evidence (3+ attempts in the window) that it is a real
// pattern rather than one bad afternoon.
const WEAK_SPOT_MIN_ATTEMPTS = 3
const WEAK_SPOT_MIN_FAILED_SHARE = 0.4
const WEAK_SPOT_MAX_CONCEPTS = 5
const READING_GAP_MIN_MISSES = 2
const READING_GAP_MAX_POINTS = 5
// Rusting: completed work whose decayed mastery has dropped far enough to
// mean the skill is leaving. Untouched-for-a-week keeps freshly practiced
// concepts out of the list on decay rounding alone.
const RUSTING_MAX_DECAYED = 0.35
const RUSTING_MIN_IDLE_DAYS = 7
const RUSTING_MAX_CONCEPTS = 5
// A reading whose best attempt never covered 60% of the rubric is a reading
// that beat the reader.
const WEAK_READING_MAX_SHARE = 0.6
const WEAK_READING_MAX_ITEMS = 3

/**
 * Laplace-smoothed failure share: (failed + 1) / (attempts + 2).
 *
 * The raw ratio makes three attempts with three failures read as 100% — the
 * same certainty as thirty of thirty, from a single bad afternoon. The
 * smoothing pulls small samples toward 50%, so a concept has to keep failing
 * as evidence accumulates to stay above the threshold. With attempts=3,
 * failed=3 → 0.8; failed=2 → 0.6; failed=1 → 0.4 — the boundary case only
 * just surfaces, which is the intended humility.
 */
export function smoothedFailureShare(failed: number, attempts: number): number {
  return (failed + 1) / (attempts + 2)
}

/** The slice of a joined submission row `aggregateConceptWeakSpots` needs. */
export interface WeakSpotSubmissionInput {
  status: string
  exercise: {
    concept: {
      id: string
      slug: string
      name: string
      track: { slug: string }
    }
  }
}

export interface WeakSpotMasteryInput {
  conceptId: string
  exercisesCompleted: number
  exercisesTotal: number
}

/**
 * Pure aggregation: groups a window of submissions by concept and keeps only
 * the ones worth surfacing — practiced enough to mean something (3+
 * attempts), where either failures dominate or completion still trails the
 * concept's total exercise count. No DB access, so it is unit-tested directly.
 */
export function aggregateConceptWeakSpots(
  recentSubmissions: readonly WeakSpotSubmissionInput[],
  masteryByConceptId: ReadonlyMap<string, WeakSpotMasteryInput>
): WeakSpotConcept[] {
  interface Accumulator {
    conceptSlug: string
    conceptName: string
    trackSlug: string
    attempts: number
    failed: number
  }

  const byConceptId = new Map<string, Accumulator>()

  for (const submission of recentSubmissions) {
    const concept = submission.exercise.concept
    const entry = byConceptId.get(concept.id) ?? {
      conceptSlug: concept.slug,
      conceptName: concept.name,
      trackSlug: concept.track.slug,
      attempts: 0,
      failed: 0,
    }
    entry.attempts += 1
    if (FAILING_SUBMISSION_STATUSES.has(submission.status)) entry.failed += 1
    byConceptId.set(concept.id, entry)
  }

  return Array.from(byConceptId.entries())
    .map(([conceptId, entry]) => {
      const mastery = masteryByConceptId.get(conceptId)
      const completed = mastery?.exercisesCompleted ?? 0
      const total = mastery?.exercisesTotal ?? 0
      return {
        conceptSlug: entry.conceptSlug,
        conceptName: entry.conceptName,
        trackSlug: entry.trackSlug,
        attempts: entry.attempts,
        failedShare: smoothedFailureShare(entry.failed, entry.attempts),
        completed,
        total,
      }
    })
    .filter(
      (row) =>
        row.attempts >= WEAK_SPOT_MIN_ATTEMPTS &&
        (row.failedShare >= WEAK_SPOT_MIN_FAILED_SHARE || row.completed < row.total)
    )
    .toSorted((a, b) => b.failedShare - a.failedShare)
    .slice(0, WEAK_SPOT_MAX_CONCEPTS)
}

export interface HeldConceptInput {
  conceptSlug: string
  conceptName: string
  trackSlug: string
}

/**
 * An unexplained agent pass is a weakness the failure scoreboard cannot see:
 * the suite went green and the schedule is holding the review a day out.
 * Those concepts must still be drillable, or the hold is diagnosis without
 * treatment.
 */
export function mergeHeldConcepts(
  spots: readonly WeakSpotConcept[],
  held: readonly HeldConceptInput[]
): WeakSpotConcept[] {
  const already = new Set(spots.map((spot) => spot.conceptSlug))
  const extras: WeakSpotConcept[] = []
  const seen = new Set<string>()
  for (const row of held) {
    if (!row.conceptSlug || already.has(row.conceptSlug) || seen.has(row.conceptSlug)) continue
    seen.add(row.conceptSlug)
    extras.push({
      conceptSlug: row.conceptSlug,
      conceptName: row.conceptName,
      trackSlug: row.trackSlug,
      attempts: 0,
      failedShare: 0,
      completed: 0,
      total: 0,
      why: 'unexplained',
    })
  }
  return [...extras.slice(0, WEAK_SPOT_MAX_CONCEPTS), ...spots]
}

export interface WeakSpotRubricRow {
  rubricResults: readonly { point: string; hit: boolean }[]
}

/**
 * Pure aggregation: unnests rubric results client-side and counts misses per
 * point text. Reading submissions are few per user and rubricResults is
 * already fetched whole, so grouping in JS avoids a jsonb-unnest query for a
 * shape that will change as rubrics are authored. No DB access, unit-tested
 * directly. Empty input (no reading submissions yet) yields [].
 */
export function aggregateReadingGaps(rows: readonly WeakSpotRubricRow[]): ReadingGap[] {
  const missesByPoint = new Map<string, number>()

  for (const row of rows) {
    for (const result of row.rubricResults) {
      if (result.hit) continue
      missesByPoint.set(result.point, (missesByPoint.get(result.point) ?? 0) + 1)
    }
  }

  return Array.from(missesByPoint.entries())
    .map(([point, misses]) => ({ point, misses }))
    .filter((gap) => gap.misses >= READING_GAP_MIN_MISSES)
    .toSorted((a, b) => b.misses - a.misses)
    .slice(0, READING_GAP_MAX_POINTS)
}

export interface RustingInput {
  conceptId: string
  masteryLevel: number
  exercisesCompleted: number
  lastPracticedAt: Date | null
}

export interface RustingConcept {
  conceptSlug: string
  conceptName: string
  trackSlug: string
  decayedMastery: number
  idleDays: number
}

/**
 * Concepts the user once held that are now rusting: real completions, decayed
 * mastery under the floor, untouched for at least a week. This is the
 * scheduler's argument made visible on a longer horizon — SM-2 brings back
 * exercises; this names the concepts whose whole neighbourhood went quiet.
 */
export function aggregateRustingConcepts(
  masteryRows: readonly RustingInput[],
  conceptsById: ReadonlyMap<string, { slug: string; name: string; trackSlug: string }>,
  now: Date = new Date()
): RustingConcept[] {
  const out: RustingConcept[] = []
  for (const row of masteryRows) {
    if (row.exercisesCompleted <= 0 || !row.lastPracticedAt) continue
    const idleDays = Math.floor(
      (now.getTime() - new Date(row.lastPracticedAt).getTime()) / (24 * 60 * 60 * 1000)
    )
    if (idleDays < RUSTING_MIN_IDLE_DAYS) continue
    const decayed = applyMasteryDecay(row.masteryLevel, row.lastPracticedAt)
    if (decayed >= RUSTING_MAX_DECAYED) continue
    const concept = conceptsById.get(row.conceptId)
    if (!concept) continue
    out.push({
      conceptSlug: concept.slug,
      conceptName: concept.name,
      trackSlug: concept.trackSlug,
      decayedMastery: Math.round(decayed * 100) / 100,
      idleDays,
    })
  }
  return out.toSorted((a, b) => a.decayedMastery - b.decayedMastery).slice(0, RUSTING_MAX_CONCEPTS)
}

export interface WeakReadingInput {
  readingExerciseId: string
  score: number
  maxScore: number
}

export interface WeakReading {
  slug: string
  title: string
  bestScore: number
  maxScore: number
}

/** Readings whose BEST attempt still missed too much of the rubric. */
export function aggregateWeakReadings(
  rows: readonly WeakReadingInput[],
  exercisesById: ReadonlyMap<string, { slug: string; title: string }>
): WeakReading[] {
  const best = new Map<string, WeakReadingInput>()
  for (const row of rows) {
    const current = best.get(row.readingExerciseId)
    if (!current || row.score / row.maxScore > current.score / current.maxScore) {
      best.set(row.readingExerciseId, row)
    }
  }
  const out: WeakReading[] = []
  for (const [id, row] of best) {
    if (row.maxScore <= 0) continue
    if (row.score / row.maxScore >= WEAK_READING_MAX_SHARE) continue
    const exercise = exercisesById.get(id)
    if (!exercise) continue
    out.push({
      slug: exercise.slug,
      title: exercise.title,
      bestScore: row.score,
      maxScore: row.maxScore,
    })
  }
  return out
    .toSorted((a, b) => a.bestScore / a.maxScore - b.bestScore / b.maxScore)
    .slice(0, WEAK_READING_MAX_ITEMS)
}

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
        }).pipe(
          Effect.map((mastery) => {
            if (!mastery) return null
            const effectiveLevel = applyMasteryDecay(mastery.masteryLevel, mastery.lastPracticedAt)
            return {
              ...mastery,
              storedMasteryLevel: mastery.masteryLevel,
              masteryLevel: effectiveLevel,
            }
          })
        ),

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

          return trackConcepts.map((concept) => {
            const mastery = masteryMap.get(concept.id) ?? null
            const decayedMastery = mastery
              ? {
                  ...mastery,
                  storedMasteryLevel: mastery.masteryLevel,
                  masteryLevel: applyMasteryDecay(mastery.masteryLevel, mastery.lastPracticedAt),
                }
              : null
            return {
              conceptId: concept.id,
              conceptSlug: concept.slug,
              conceptName: concept.name,
              mastery: decayedMastery,
              totalExercises: concept.exercises.length,
            }
          })
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

      getCompletedExerciseIds: (userId) =>
        Effect.tryPromise({
          try: () =>
            db.query.userProgress.findMany({
              where: and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)),
              columns: { exerciseId: true },
            }),
          catch: () => new NotFoundError({ resource: 'Progress', id: userId }),
        }).pipe(Effect.map((rows) => rows.map((row) => row.exerciseId))),

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

          // Presence over streaks: which of the last 7 local-UTC days saw a
          // submission. Attempts count — showing up and failing is practice.
          const WINDOW = 7
          const submittedDays = new Set(
            userSubmissions.map((submission) => toDateKey(submission.createdAt))
          )
          const days: boolean[] = []
          for (let offset = WINDOW - 1; offset >= 0; offset--) {
            const day = new Date(Date.now() - offset * 24 * 60 * 60 * 1000)
            days.push(submittedDays.has(toDateKey(day)))
          }

          const lastActivityDate = completedProgress[0]?.completedAt ?? null

          return {
            totalExercisesCompleted,
            presence: {
              window: WINDOW,
              days,
              practiced: days.filter(Boolean).length,
            },
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

      getWeakSpots: (userId) =>
        Effect.gen(function* () {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

          const [recentSubmissions, masteryRecords, userReadingSubmissions, allConcepts, heldRows] =
            yield* Effect.tryPromise({
              try: () =>
                Promise.all([
                  db.query.submissions.findMany({
                    where: and(
                      eq(submissions.userId, userId),
                      gte(submissions.createdAt, thirtyDaysAgo)
                    ),
                    with: { exercise: { with: { concept: { with: { track: true } } } } },
                  }),
                  db.query.conceptMastery.findMany({
                    where: eq(conceptMastery.userId, userId),
                    columns: {
                      conceptId: true,
                      exercisesCompleted: true,
                      exercisesTotal: true,
                      masteryLevel: true,
                      lastPracticedAt: true,
                    },
                  }),
                  db.query.readingSubmissions.findMany({
                    where: eq(readingSubmissions.userId, userId),
                    columns: {
                      rubricResults: true,
                      readingExerciseId: true,
                      score: true,
                      maxScore: true,
                    },
                  }),
                  db.query.concepts.findMany({
                    columns: { id: true, slug: true, name: true },
                    with: { track: { columns: { slug: true } } },
                  }),
                  db.query.reviewSchedules.findMany({
                    where: and(
                      eq(reviewSchedules.userId, userId),
                      isNotNull(reviewSchedules.heldNextReviewAt)
                    ),
                    with: {
                      exercise: {
                        columns: { id: true },
                        with: {
                          concept: {
                            columns: { slug: true, name: true },
                            with: { track: { columns: { slug: true } } },
                          },
                        },
                      },
                    },
                  }),
                ]),
              catch: () => new NotFoundError({ resource: 'WeakSpots', id: userId }),
            })

          const masteryByConceptId = new Map(masteryRecords.map((m) => [m.conceptId, m]))
          const conceptsById = new Map(
            allConcepts.map((concept) => [
              concept.id,
              { slug: concept.slug, name: concept.name, trackSlug: concept.track.slug },
            ])
          )

          // The reading titles, only for the exercises the user attempted.
          const attemptedIds = [...new Set(userReadingSubmissions.map((s) => s.readingExerciseId))]
          const readingMeta = attemptedIds.length
            ? yield* Effect.tryPromise({
                try: () =>
                  db.query.readingExercises.findMany({
                    columns: { id: true, slug: true, title: true },
                  }),
                catch: () => new NotFoundError({ resource: 'WeakSpots', id: userId }),
              })
            : []
          const readingById = new Map(
            readingMeta.map((row) => [row.id, { slug: row.slug, title: row.title }])
          )

          const held = heldRows.flatMap((row) => {
            const concept = row.exercise?.concept
            const trackSlug = concept?.track?.slug
            if (!concept || !trackSlug) return []
            return [
              {
                conceptSlug: concept.slug,
                conceptName: concept.name,
                trackSlug,
              },
            ]
          })

          return {
            concepts: mergeHeldConcepts(
              aggregateConceptWeakSpots(recentSubmissions, masteryByConceptId),
              held
            ),
            readingGaps: aggregateReadingGaps(userReadingSubmissions),
            rusting: aggregateRustingConcepts(masteryRecords, conceptsById),
            weakReadings: aggregateWeakReadings(userReadingSubmissions, readingById),
          }
        }),
    })
  })
)
