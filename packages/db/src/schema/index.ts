import type { BlankRegionInStarter } from '@blankcode/shared/types'
import {
  ACHIEVEMENT_TYPES,
  DIFFICULTIES,
  EXERCISE_TYPES,
  SUBMISSION_STATUSES,
  TRACK_SLUGS,
} from '@blankcode/shared/types'
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const difficultyEnum = pgEnum('difficulty', [...DIFFICULTIES] as [string, ...string[]])

export const submissionStatusEnum = pgEnum('submission_status', [...SUBMISSION_STATUSES] as [
  string,
  ...string[],
])

export const trackSlugEnum = pgEnum('track_slug', [...TRACK_SLUGS] as [string, ...string[]])

export const turnSessionStatusEnum = pgEnum('turn_session_status', [
  'open',
  'submitted',
  'abandoned',
])

export const exerciseTypeEnum = pgEnum('exercise_type', [...EXERCISE_TYPES] as [
  string,
  ...string[],
])

export const achievementTypeEnum = pgEnum('achievement_type', [...ACHIEVEMENT_TYPES] as [
  string,
  ...string[],
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    username: varchar('username', { length: 30 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 100 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_username_idx').on(table.username),
  ]
)

export const usersRelations = relations(users, ({ many }) => ({
  submissions: many(submissions),
  userProgress: many(userProgress),
  conceptMastery: many(conceptMastery),
  refreshTokens: many(refreshTokens),
  codeDrafts: many(codeDrafts),
  reviewSchedules: many(reviewSchedules),
}))

export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: trackSlugEnum('slug').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(),
    iconUrl: text('icon_url'),
    order: integer('order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('tracks_slug_idx').on(table.slug)]
)

export const tracksRelations = relations(tracks, ({ many }) => ({
  concepts: many(concepts),
}))

export const concepts = pgTable(
  'concepts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(),
    order: integer('order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('concepts_track_slug_idx').on(table.trackId, table.slug),
    index('concepts_track_id_idx').on(table.trackId),
  ]
)

export const conceptsRelations = relations(concepts, ({ one, many }) => ({
  track: one(tracks, {
    fields: [concepts.trackId],
    references: [tracks.id],
  }),
  exercises: many(exercises),
  conceptMastery: many(conceptMastery),
}))

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    type: exerciseTypeEnum('type').notNull().default('blank'),
    starterCode: text('starter_code').notNull(),
    solutionCode: text('solution_code').notNull(),
    testCode: text('test_code').notNull(),
    hints: jsonb('hints').$type<string[]>().notNull().default([]),
    blanks: jsonb('blanks').$type<BlankRegionInStarter[]>().notNull().default([]),
    order: integer('order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('exercises_concept_slug_idx').on(table.conceptId, table.slug),
    index('exercises_concept_id_idx').on(table.conceptId),
    index('exercises_difficulty_idx').on(table.difficulty),
    index('exercises_type_idx').on(table.type),
  ]
)

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  concept: one(concepts, {
    fields: [exercises.conceptId],
    references: [concepts.id],
  }),
  submissions: many(submissions),
  userProgress: many(userProgress),
  codeDrafts: many(codeDrafts),
  reviewSchedules: many(reviewSchedules),
}))

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    status: submissionStatusEnum('status').notNull().default('pending'),
    testResults: jsonb('test_results').$type<
      Array<{
        name: string
        passed: boolean
        message: string | null
        duration: number
      }>
    >(),
    errorMessage: text('error_message'),
    executionTimeMs: integer('execution_time_ms'),
    // Bumped by the reaper when a 'running' lease expires. Bounded retries
    // distinguish worker crashes (retryable) from legitimate test failures
    // (which never enter the reaper path).
    attemptCount: integer('attempt_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('submissions_user_id_idx').on(table.userId),
    index('submissions_exercise_id_idx').on(table.exerciseId),
    index('submissions_user_exercise_idx').on(table.userId, table.exerciseId),
    index('submissions_status_idx').on(table.status),
    index('submissions_created_at_idx').on(table.createdAt),
  ]
)

export const submissionsRelations = relations(submissions, ({ one }) => ({
  user: one(users, {
    fields: [submissions.userId],
    references: [users.id],
  }),
  exercise: one(exercises, {
    fields: [submissions.exerciseId],
    references: [exercises.id],
  }),
}))

export const userProgress = pgTable(
  'user_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    isCompleted: boolean('is_completed').notNull().default(false),
    attempts: integer('attempts').notNull().default(0),
    bestSubmissionId: uuid('best_submission_id').references(() => submissions.id, {
      onDelete: 'set null',
    }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_progress_user_exercise_idx').on(table.userId, table.exerciseId),
    index('user_progress_user_id_idx').on(table.userId),
    index('user_progress_exercise_id_idx').on(table.exerciseId),
  ]
)

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
  exercise: one(exercises, {
    fields: [userProgress.exerciseId],
    references: [exercises.id],
  }),
  bestSubmission: one(submissions, {
    fields: [userProgress.bestSubmissionId],
    references: [submissions.id],
  }),
}))

export const conceptMastery = pgTable(
  'concept_mastery',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    masteryLevel: real('mastery_level').notNull().default(0),
    exercisesCompleted: integer('exercises_completed').notNull().default(0),
    exercisesTotal: integer('exercises_total').notNull().default(0),
    lastPracticedAt: timestamp('last_practiced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('concept_mastery_user_concept_idx').on(table.userId, table.conceptId),
    index('concept_mastery_user_id_idx').on(table.userId),
    index('concept_mastery_concept_id_idx').on(table.conceptId),
  ]
)

export const conceptMasteryRelations = relations(conceptMastery, ({ one }) => ({
  user: one(users, {
    fields: [conceptMastery.userId],
    references: [users.id],
  }),
  concept: one(concepts, {
    fields: [conceptMastery.conceptId],
    references: [concepts.id],
  }),
}))

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_idx').on(table.token),
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_expires_at_idx').on(table.expiresAt),
  ]
)

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}))

export const codeDrafts = pgTable(
  'code_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('code_drafts_user_exercise_idx').on(table.userId, table.exerciseId),
    index('code_drafts_user_id_idx').on(table.userId),
    index('code_drafts_exercise_id_idx').on(table.exerciseId),
    index('code_drafts_updated_at_idx').on(table.updatedAt),
  ]
)

export const codeDraftsRelations = relations(codeDrafts, ({ one }) => ({
  user: one(users, {
    fields: [codeDrafts.userId],
    references: [users.id],
  }),
  exercise: one(exercises, {
    fields: [codeDrafts.exerciseId],
    references: [exercises.id],
  }),
}))

export const reviewSchedules = pgTable(
  'review_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    intervalDays: integer('interval_days').notNull().default(1),
    repetitions: integer('repetitions').notNull().default(0),
    easeFactor: real('ease_factor').notNull().default(2.5),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }).notNull(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('review_schedules_user_exercise_idx').on(table.userId, table.exerciseId),
    index('review_schedules_next_review_idx').on(table.nextReviewAt),
    index('review_schedules_user_id_idx').on(table.userId),
  ]
)

export const reviewSchedulesRelations = relations(reviewSchedules, ({ one }) => ({
  user: one(users, {
    fields: [reviewSchedules.userId],
    references: [users.id],
  }),
  exercise: one(exercises, {
    fields: [reviewSchedules.exerciseId],
    references: [exercises.id],
  }),
}))

/*
 * The `cluster_*` tables are owned and migrated by `@effect/cluster` itself.
 *
 * They used to be mirrored here so `drizzle-kit push` would create them, but
 * that made the schema drift on every cluster upgrade — 0.60 renamed the
 * migrations table's `id` column to `migration_id`, and the stale Drizzle-made
 * table stopped the API from booting. Let the library create its own tables.
 */

/**
 * One row per metered action a user takes.
 *
 * Two things needed this and neither could use what was there. The AI
 * explanation budget lived in a Map inside the request handler, which means
 * every function instance enforced its own copy of the limit — the real ceiling
 * was twenty per hour multiplied by however many instances happened to be warm,
 * and nothing survived a cold start.
 *
 * Submissions are not recorded here. They already have a table with a user and
 * a timestamp on it, so counting them over a window is a query rather than a
 * second write — and two records of the same fact eventually disagree.
 *
 * Rows rather than a counter column, because the question is always asked over
 * a moving window ("in the last hour"), and a counter cannot answer that
 * without also storing when it was last reset.
 */
/**
 * One attempt at a turn-budget exercise.
 *
 * The exercise being practised is *directing a model with a fixed number of
 * messages*, so the state that matters is not the code — it is how many turns
 * are left and what has already been said. None of that can live in the client:
 * a budget the browser reports is not a budget.
 *
 * `messages` holds the transcript. It is written on every turn rather than
 * reconstructed, because the model's replies are not reproducible and a session
 * that loses them cannot be resumed or reviewed afterwards.
 *
 * `revealedAt` is what stops the obvious cheat. The hidden tests are the whole
 * grading mechanism, and a learner who can see them will paste them to the
 * model — at which point the skill being practised is copy-paste. Tests are
 * served only once this is set, and it is set only when the session ends.
 */
export const turnSessions = pgTable(
  'turn_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    /** Fixed when the session starts, so changing the default cannot move it. */
    maxTurns: integer('max_turns').notNull(),
    turnsUsed: integer('turns_used').notNull().default(0),
    messages: jsonb('messages')
      .$type<Array<{ role: 'user' | 'assistant'; content: string }>>()
      .notNull()
      .default([]),
    /** The code the learner finally submitted, once they end the session. */
    finalCode: text('final_code'),
    status: turnSessionStatusEnum('status').notNull().default('open'),
    revealedAt: timestamp('revealed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('turn_sessions_user_idx').on(table.userId, table.createdAt),
    // One open session per exercise per user: starting a second one to get a
    // fresh budget is exactly the thing the budget exists to prevent.
    uniqueIndex('turn_sessions_one_open_idx')
      .on(table.userId, table.exerciseId)
      .where(sql`status = 'open'`),
  ]
)

export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** What was metered: `ai_explain`, `submission`. */
    kind: varchar('kind', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every read is "this user, this kind, since this time" — the index has to
    // carry all three or the count degrades into a scan as the table grows.
    index('usage_events_user_kind_created_idx').on(table.userId, table.kind, table.createdAt),
  ]
)

export const learningPaths = pgTable('learning_paths', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  color: varchar('color', { length: 20 }).notNull(),
  order: integer('order').notNull().default(0),
  challengeIds: jsonb('challenge_ids').$type<string[]>().notNull().default([]),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementType: achievementTypeEnum('achievement_type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    icon: varchar('icon', { length: 50 }).notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    index('user_achievements_user_id_idx').on(table.userId),
    index('user_achievements_user_type_idx').on(table.userId, table.achievementType),
  ]
)
