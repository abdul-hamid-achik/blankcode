import { relations } from 'drizzle-orm'
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

export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced', 'expert'])

export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'running',
  'passed',
  'failed',
  'error',
])

export const trackSlugEnum = pgEnum('track_slug', [
  'typescript',
  'vue',
  'react',
  'node',
  'go',
  'rust',
  'python',
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
    starterCode: text('starter_code').notNull(),
    solutionCode: text('solution_code').notNull(),
    testCode: text('test_code').notNull(),
    hints: jsonb('hints').$type<string[]>().notNull().default([]),
    order: integer('order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('exercises_concept_slug_idx').on(table.conceptId, table.slug),
    index('exercises_concept_id_idx').on(table.conceptId),
    index('exercises_difficulty_idx').on(table.difficulty),
  ]
)

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  concept: one(concepts, {
    fields: [exercises.conceptId],
    references: [concepts.id],
  }),
  submissions: many(submissions),
  userProgress: many(userProgress),
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
    executionTimeMs: integer('execution_time_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('submissions_user_id_idx').on(table.userId),
    index('submissions_exercise_id_idx').on(table.exerciseId),
    index('submissions_user_exercise_idx').on(table.userId, table.exerciseId),
    index('submissions_status_idx').on(table.status),
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
