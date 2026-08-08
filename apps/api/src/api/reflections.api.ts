import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { Authorization } from '../middleware/auth.middleware.js'
import { BadRequestError, NotFoundError } from './errors.js'

/**
 * Reflections: the human's answers to the questions an agent asked after a
 * verdict. Create is what agents call (practice-scoped); the read side is
 * how the site shows a person what they could — and could not — explain.
 */

const CreateReflectionPayload = Schema.Struct({
  exerciseId: Schema.String,
  question: Schema.String.pipe(Schema.maxLength(1000)),
  answer: Schema.String.pipe(Schema.maxLength(10_000)),
})

export class ReflectionsApi extends HttpApiGroup.make('reflections')
  .add(
    HttpApiEndpoint.post('createReflection', '/reflections')
      .setPayload(CreateReflectionPayload)
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
      .addError(BadRequestError)
  )
  .add(
    HttpApiEndpoint.get(
      'reflectionsByExercise'
    )`/reflections/exercise/${HttpApiSchema.param('exerciseId', Schema.String)}`
      .addSuccess(Schema.Array(Schema.Unknown))
      .addError(NotFoundError)
  )
  .middleware(Authorization) {}
