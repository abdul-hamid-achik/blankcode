import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { Authorization } from '../middleware/auth.middleware.js'
import { BadRequestError, NotFoundError } from './errors.js'

const SaveDraftPayload = Schema.Struct({
  code: Schema.String.pipe(Schema.maxLength(50000)),
})

export class ExercisesApi extends HttpApiGroup.make('exercises')
  // Public endpoints (no auth)
  .add(
    HttpApiEndpoint.get('getById')`/exercises/${HttpApiSchema.param('id', Schema.String)}`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get(
      'getByConceptSlug'
    )`/tracks/${HttpApiSchema.param('trackSlug', Schema.String)}/concepts/${HttpApiSchema.param('conceptSlug', Schema.String)}/exercises`
      .addSuccess(Schema.Array(Schema.Unknown))
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get(
      'getBySlug'
    )`/tracks/${HttpApiSchema.param('trackSlug', Schema.String)}/concepts/${HttpApiSchema.param('conceptSlug', Schema.String)}/exercises/${HttpApiSchema.param('exerciseSlug', Schema.String)}`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
  )
  // Authenticated endpoints
  .add(
    HttpApiEndpoint.get(
      'getProgress'
    )`/exercises/${HttpApiSchema.param('id', Schema.String)}/progress`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
      .middleware(Authorization)
  )
  .add(
    HttpApiEndpoint.post('saveDraft')`/exercises/${HttpApiSchema.param('id', Schema.String)}/draft`
      .setPayload(SaveDraftPayload)
      .addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
      .addError(NotFoundError)
      .addError(BadRequestError)
      .middleware(Authorization)
  )
  .add(
    HttpApiEndpoint.del('deleteDraft')`/exercises/${HttpApiSchema.param('id', Schema.String)}/draft`
      .addSuccess(Schema.Struct({ success: Schema.Literal(true) }), { status: 200 })
      .addError(BadRequestError)
      .middleware(Authorization)
  ) {}
