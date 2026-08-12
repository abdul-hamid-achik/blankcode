import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { Authorization } from '../middleware/auth.middleware.js'
import { NotFoundError } from './errors.js'

const WeakSpotConceptSchema = Schema.Struct({
  conceptSlug: Schema.String,
  conceptName: Schema.String,
  trackSlug: Schema.String,
  attempts: Schema.Number,
  failedShare: Schema.Number,
  completed: Schema.Number,
  total: Schema.Number,
  why: Schema.optional(Schema.Literal('failures', 'unexplained')),
})

const ReadingGapSchema = Schema.Struct({
  point: Schema.String,
  misses: Schema.Number,
})

const RustingConceptSchema = Schema.Struct({
  conceptSlug: Schema.String,
  conceptName: Schema.String,
  trackSlug: Schema.String,
  decayedMastery: Schema.Number,
  idleDays: Schema.Number,
})

const WeakReadingSchema = Schema.Struct({
  slug: Schema.String,
  title: Schema.String,
  bestScore: Schema.Number,
  maxScore: Schema.Number,
})

// The review caught this schema silently DROPPING two lists the service
// returns — Schema.encode strips unknown keys, so the rusting and
// weak-readings UI sections were dead templates fed by discarded queries.
// The schema is the contract; it has to say everything the service means.
const WeakSpotsSchema = Schema.Struct({
  concepts: Schema.Array(WeakSpotConceptSchema),
  readingGaps: Schema.Array(ReadingGapSchema),
  rusting: Schema.Array(RustingConceptSchema),
  weakReadings: Schema.Array(WeakReadingSchema),
})

export class ProgressApi extends HttpApiGroup.make('progress')
  .add(
    HttpApiEndpoint.get('summary', '/progress/summary')
      .addSuccess(Schema.Array(Schema.Unknown))
      .addError(NotFoundError)
  )
  .add(
    // The IDs of every exercise this user has completed. One flat list rather
    // than a per-surface aggregate, because done-marks are wanted by paths,
    // track pages, and concept pages alike, and each can intersect it with
    // whatever it is rendering.
    HttpApiEndpoint.get('completed', '/progress/completed')
      .addSuccess(Schema.Array(Schema.String))
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get('stats', '/progress/stats')
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get(
      'exerciseProgress'
    )`/progress/exercises/${HttpApiSchema.param('exerciseId', Schema.String)}`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get(
      'conceptMastery'
    )`/progress/concepts/${HttpApiSchema.param('conceptId', Schema.String)}`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get(
      'trackProgress'
    )`/progress/tracks/${HttpApiSchema.param('trackSlug', Schema.String)}`
      .addSuccess(Schema.Array(Schema.Unknown))
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get('activity', '/progress/activity')
      .addSuccess(Schema.Array(Schema.Unknown))
      .addError(NotFoundError)
  )
  .add(
    // The seed of per-user content generation: concepts a user keeps failing
    // and reading rubric points they keep missing, both over recent history.
    HttpApiEndpoint.get('weakSpots', '/progress/weak-spots')
      .addSuccess(WeakSpotsSchema)
      .addError(NotFoundError)
  )
  .middleware(Authorization) {}
