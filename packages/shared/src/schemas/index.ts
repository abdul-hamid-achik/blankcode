import { Schema } from 'effect'
import { DIFFICULTIES, EXERCISE_TYPES, SUBMISSION_STATUSES, TRACK_SLUGS } from '../types/index.js'

export const difficultySchema = Schema.Literal(...DIFFICULTIES)

export const submissionStatusSchema = Schema.Literal(...SUBMISSION_STATUSES)

export const trackSlugSchema = Schema.Literal(...TRACK_SLUGS)

export const exerciseTypeSchema = Schema.Literal(...EXERCISE_TYPES)

export const paginationSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), {
    default: () => 1,
  }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.positive(), Schema.lessThanOrEqualTo(100)),
    { default: () => 20 }
  ),
})

export const userCreateSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  username: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(30),
    Schema.pattern(/^[a-zA-Z0-9_-]+$/)
  ),
  password: Schema.String.pipe(Schema.minLength(8), Schema.maxLength(100)),
  displayName: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))),
})

export const userLoginSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(1)),
})

export const userUpdateSchema = Schema.Struct({
  displayName: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))),
  avatarUrl: Schema.optional(
    Schema.String.pipe(Schema.pattern(/^https:\/\//), Schema.maxLength(2048))
  ),
})

export const trackCreateSchema = Schema.Struct({
  slug: trackSlugSchema,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  description: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(1000)),
  iconUrl: Schema.optional(Schema.String.pipe(Schema.pattern(/^https?:\/\//))),
  order: Schema.optionalWith(Schema.Int.pipe(Schema.nonNegative()), { default: () => 0 }),
  isPublished: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

export const conceptCreateSchema = Schema.Struct({
  trackId: Schema.UUID,
  slug: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.pattern(/^[a-z0-9-]+$/)
  ),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  description: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(1000)),
  order: Schema.optionalWith(Schema.Int.pipe(Schema.nonNegative()), { default: () => 0 }),
  isPublished: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

export const exerciseCreateSchema = Schema.Struct({
  conceptId: Schema.UUID,
  slug: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.pattern(/^[a-z0-9-]+$/)
  ),
  title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
  description: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(5000)),
  difficulty: difficultySchema,
  type: Schema.optionalWith(exerciseTypeSchema, { default: () => 'blank' }),
  starterCode: Schema.String.pipe(Schema.minLength(1)),
  solutionCode: Schema.String.pipe(Schema.minLength(1)),
  testCode: Schema.String.pipe(Schema.minLength(1)),
  hints: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  order: Schema.optionalWith(Schema.Int.pipe(Schema.nonNegative()), { default: () => 0 }),
  isPublished: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

export const submissionCreateSchema = Schema.Struct({
  exerciseId: Schema.UUID,
  code: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50000)),
})

export const blankRegionSchema = Schema.Struct({
  id: Schema.String,
  startLine: Schema.Int.pipe(Schema.nonNegative()),
  startColumn: Schema.Int.pipe(Schema.nonNegative()),
  endLine: Schema.Int.pipe(Schema.nonNegative()),
  endColumn: Schema.Int.pipe(Schema.nonNegative()),
  placeholder: Schema.String,
  solution: Schema.String,
})

export const exerciseFrontmatterSchema = Schema.Struct({
  slug: Schema.String.pipe(Schema.minLength(1), Schema.pattern(/^[a-z0-9-]+$/)),
  title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
  description: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(5000)),
  difficulty: difficultySchema,
  type: Schema.optionalWith(exerciseTypeSchema, { default: () => 'blank' }),
  hints: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
})

export type UserCreateInput = Schema.Schema.Type<typeof userCreateSchema>
export type UserLoginInput = Schema.Schema.Type<typeof userLoginSchema>
export type UserUpdateInput = Schema.Schema.Type<typeof userUpdateSchema>
export type TrackCreateInput = Schema.Schema.Type<typeof trackCreateSchema>
export type ConceptCreateInput = Schema.Schema.Type<typeof conceptCreateSchema>
export type ExerciseCreateInput = Schema.Schema.Type<typeof exerciseCreateSchema>
export type SubmissionCreateInput = Schema.Schema.Type<typeof submissionCreateSchema>
export type BlankRegionInput = Schema.Schema.Type<typeof blankRegionSchema>
export type ExerciseFrontmatterInput = Schema.Schema.Type<typeof exerciseFrontmatterSchema>
export type PaginationInput = Schema.Schema.Type<typeof paginationSchema>
