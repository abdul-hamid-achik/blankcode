import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { NotFoundError } from './errors.js'

export class TracksApi extends HttpApiGroup.make('tracks')
  .add(
    HttpApiEndpoint.get('list', '/tracks')
      .addSuccess(Schema.Array(Schema.Unknown))
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get('getBySlug')`/tracks/${HttpApiSchema.param('slug', Schema.String)}`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
  ) {}
