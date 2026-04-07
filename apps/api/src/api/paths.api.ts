import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'

export class PathsApi extends HttpApiGroup.make('paths')
  .add(HttpApiEndpoint.get('getAll')`/paths`.addSuccess(Schema.Array(Schema.Unknown)))
  .add(
    HttpApiEndpoint.get(
      'getBySlug'
    )`/paths/${HttpApiSchema.param('slug', Schema.String)}`.addSuccess(Schema.Unknown)
  ) {}
