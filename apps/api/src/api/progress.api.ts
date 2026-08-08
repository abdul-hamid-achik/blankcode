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
})

const ReadingGapSchema = Schema.Struct({
  point: Schema.String,
  misses: Schema.Number,
})

const WeakSpotsSchema = Schema.Struct({
  concepts: Schema.Array(WeakSpotConceptSchema),
  readingGaps: Schema.Array(ReadingGapSchema),
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
