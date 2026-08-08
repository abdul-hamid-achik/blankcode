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

/**
 * Who typed: the web editor or an agent holding a practice token. A column,
 * not a heuristic — the server knows the credential and cannot know the
 * hands, so it records the credential and never pretends to detect more.
 */
export const submissionViaEnum = pgEnum('submission_via', ['web', 'agent'])

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
    /**
     * Billing, on the user rather than in a table of its own.
     *
     * A user has at most one subscription and the questions asked are always
     * "can this person do the thing" — a join for that is a join on every
     * request. The id is stored here and not the other way round because
     * Stripe's customer is a mirror of our user, not the source of them.
     */
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    /**
     * Mirrors Stripe's subscription status verbatim. Not booleans like
     * `isPaid`: `past_due` and `canceled` are different situations that want
     * different copy, and collapsing them at write time throws that away.
     */
    subscriptionStatus: varchar('subscription_status', { length: 40 }),
    subscriptionPriceId: varchar('subscription_price_id', { length: 255 }),
    /** When paid access lapses. Access is denied on time, not on a webhook. */
    subscriptionEndsAt: timestamp('subscription_ends_at', { withTimezone: true }),
    /**
     * Opt-out for the review reminder, defaulting to on.
     *
     * On by default because the reminder IS the product: spaced repetition
     * without a nudge depends on people remembering on their own, which is the
     * exact failure the mechanism exists to remove. The email itself says how
     * to turn it off, which is the honest version of a default.
     */
    /**
     * Preferred AI tier ('fast' | 'standard' | 'advanced') for model-backed
     * features. A tier name, never a raw gateway id — the mapping lives in
     * code so models rotate without a migration. Null means the default.
     */
    aiModel: varchar('ai_model', { length: 20 }),
    reviewRemindersEnabled: boolean('review_reminders_enabled').notNull().default(true),
    /** When the last reminder went out, so one bad cron cannot double-send. */
    lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    // Every webhook arrives keyed by the Stripe customer, never by our user id.
    index('users_stripe_customer_idx').on(table.stripeCustomerId),
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
    /**
     * Context-selection exercises only: the menu of sources, their prices, and
     * which of them the question genuinely needs.
     *
     * On the exercise rather than in a table of its own because it is authored
     * content that changes with the markdown, and a separate table would have
     * to be kept in step with an import that already rewrites this row.
     */
    /** Turn-budget exercises only: how many messages the learner gets. */
    turnBudget: integer('turn_budget'),
    contextSources: jsonb('context_sources').$type<{
      sources: Array<{ id: string; label: string; tokens: number; content: string }>
      required: string[]
      accept: string
    } | null>(),
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
    via: submissionViaEnum('via').notNull().default('web'),
    apiTokenId: uuid('api_token_id').references(() => apiTokens.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('submissions_user_id_idx').on(table.userId),
    // Covers the per-user windowed reads (weak spots, drill evidence).
    index('submissions_user_created_idx').on(table.userId, table.createdAt),
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

/**
 * A sign-in method that is not a password.
 *
 * Separate rows rather than columns on `users` because an account may have
 * several: a password, a GitHub identity and a Google one all pointing at the
 * same person. Columns would mean adding one per provider forever, and would
 * make "how many ways can this person get in" — the question that decides
 * whether unlinking is safe — a thing you compute rather than count.
 *
 * `providerAccountId` is the provider's own immutable id, never the email.
 * People change their GitHub email; the account is still theirs. Matching on
 * the address would also mean that whoever controls an address at the provider
 * controls the account here.
 */
export const linkedIdentities = pgTable(
  'linked_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** `github` or `google`. */
    provider: varchar('provider', { length: 32 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    /** What the provider said the address was, for display. Not the key. */
    email: varchar('email', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One provider account belongs to exactly one user. Without this, a second
    // sign-in could attach the same GitHub account to a different local user
    // and either of them could then log in as the other.
    uniqueIndex('linked_identities_provider_account_idx').on(
      table.provider,
      table.providerAccountId
    ),
    // And one provider per user: linking a second GitHub account to the same
    // account is not a feature, it is a way to lose track of who can get in.
    uniqueIndex('linked_identities_user_provider_idx').on(table.userId, table.provider),
  ]
)

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

/**
 * One attempt at a context-selection exercise.
 *
 * The sources and which of them are required are snapshotted here at creation
 * rather than read from the exercise on each request. An exercise that gains a
 * source, or reprices one, must not change the cost of an attempt already under
 * way — and a score that moves after the fact is not a score.
 *
 * `selected` is the server's record of what was actually handed over. It cannot
 * be a number the client reports: the whole exercise is about the cost of what
 * you asked for, so the ledger has to be kept by whoever serves the content.
 */
export const contextSessions = pgTable(
  'context_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    sources: jsonb('sources')
      .$type<Array<{ id: string; label: string; tokens: number }>>()
      .notNull()
      .default([]),
    required: jsonb('required').$type<string[]>().notNull().default([]),
    selected: jsonb('selected').$type<string[]>().notNull().default([]),
    answer: text('answer'),
    status: turnSessionStatusEnum('status').notNull().default('open'),
    revealedAt: timestamp('revealed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('context_sessions_user_idx').on(table.userId, table.createdAt),
    // Same reason as the turn sessions: a second open attempt is a fresh budget.
    uniqueIndex('context_sessions_one_open_idx')
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
    /** What was metered: `ai_explain`, `submission`, `practice_run`. */
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

/**
 * Practice tokens: the credential a coding agent carries into the API.
 *
 * Modeled on refresh_tokens — random secret, sha256 lookup in `token`,
 * revocation as a timestamp — with one deliberate divergence: no bcrypt
 * verify hash. A refresh token is presented once per session; this rides
 * every tool call, and bcrypt per call buys nothing against a 256-bit
 * random secret. Scope is recorded but 'practice' is the only value cut so
 * far; the API enforces it as a route allowlist.
 */
/**
 * Reading practice (form R): a small codebase you read in full, then explain
 * in prose; an AI grades the explanation against an authored rubric. Its own
 * tables — the shape shares nothing with a code submission (no starter, no
 * suite, no sandbox), and forcing it into `exercises` would leave most
 * columns lying.
 */
export const readingExercises = pgTable(
  'reading_exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    /** What to explain, and for whom ("explain this to a new teammate"). */
    brief: text('brief').notNull(),
    language: varchar('language', { length: 20 }).notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    /** The codebase: every file the reader can open. */
    files: jsonb('files').$type<Array<{ path: string; content: string }>>().notNull(),
    /**
     * What a complete explanation must cover. Authored, weighted, and never
     * served to the client before a submission is graded — the rubric IS the
     * answer key.
     */
    rubric: jsonb('rubric').$type<Array<{ id: string; point: string; weight: number }>>().notNull(),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('reading_exercises_slug_idx').on(table.slug)]
)

/**
 * One row per attempt, kept forever: the rubric points a person keeps
 * missing are the seed of per-user content generation.
 */
export const readingSubmissions = pgTable(
  'reading_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readingExerciseId: uuid('reading_exercise_id')
      .notNull()
      .references(() => readingExercises.id, { onDelete: 'cascade' }),
    explanation: text('explanation').notNull(),
    score: integer('score').notNull(),
    maxScore: integer('max_score').notNull(),
    rubricResults: jsonb('rubric_results')
      .$type<Array<{ id: string; point: string; weight: number; hit: boolean; note: string }>>()
      .notNull(),
    /** Which AI tier graded it — part of the record, not trivia. */
    model: varchar('model', { length: 60 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('reading_submissions_user_exercise_idx').on(table.userId, table.readingExerciseId),
  ]
)

/**
 * Per-user generated drills: weak-spots closing their loop. Authored by a
 * model FROM the user's own failure pattern, then verified the only way this
 * repo trusts — the reference solution executed against the drill's own
 * tests in the real sandbox — before the row may exist. Private to the user;
 * solutions and tests never leave the server.
 */
export const customDrills = pgTable(
  'custom_drills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conceptSlug: varchar('concept_slug', { length: 100 }).notNull(),
    trackSlug: varchar('track_slug', { length: 50 }).notNull(),
    language: varchar('language', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    starterCode: text('starter_code').notNull(),
    solutionCode: text('solution_code').notNull(),
    testCode: text('test_code').notNull(),
    blanks: jsonb('blanks')
      .$type<
        Array<{ id: string; from: number; to: number; placeholder: string; solution: string }>
      >()
      .notNull(),
    /** The weak-spot evidence that seeded it — the why, kept with the what. */
    source: jsonb('source')
      .$type<{ failedShare: number; attempts: number; window: string }>()
      .notNull(),
    model: varchar('model', { length: 60 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    solvedAt: timestamp('solved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('custom_drills_user_created_idx').on(table.userId, table.createdAt)]
)

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The label the owner gave it ("laptop", "codex at work"). */
    name: varchar('name', { length: 100 }).notNull(),
    /** First characters of the secret, for recognising it in a list. */
    tokenPrefix: varchar('token_prefix', { length: 16 }).notNull(),
    /** sha256 of the full secret. The secret itself is never stored. */
    token: text('token').notNull(),
    scope: varchar('scope', { length: 20 }).notNull().default('practice'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('api_tokens_token_idx').on(table.token),
    index('api_tokens_user_id_idx').on(table.userId),
  ]
)

/**
 * Agent practice sessions, maintained implicitly: each tool call upserts the
 * row whose lastSeenAt is within a 30-minute window, else starts a new one.
 * No start/end tools — an agent is a bad bookkeeper, and a session the
 * client reports is a claim, not a session.
 */
export const harnessSessions = pgTable(
  'harness_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    apiTokenId: uuid('api_token_id').references(() => apiTokens.id, { onDelete: 'set null' }),
    /** What the MCP client said it was ("claude-code", "codex"). */
    clientName: text('client_name'),
    clientVersion: text('client_version'),
    toolCalls: integer('tool_calls').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('harness_sessions_user_id_idx').on(table.userId),
    index('harness_sessions_token_seen_idx').on(table.apiTokenId, table.lastSeenAt),
  ]
)

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
