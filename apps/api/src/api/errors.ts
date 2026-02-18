import { HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  'NotFoundError',
  { resource: Schema.String, id: Schema.String },
  HttpApiSchema.annotations({ status: 404 })
) {}

export class ConflictError extends Schema.TaggedError<ConflictError>()(
  'ConflictError',
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 409 })
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  'UnauthorizedError',
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 401 })
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
  'ForbiddenError',
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 403 })
) {}

export class BadRequestError extends Schema.TaggedError<BadRequestError>()(
  'BadRequestError',
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 400 })
) {}

export class QueueError extends Schema.TaggedError<QueueError>()(
  'QueueError',
  { submissionId: Schema.String, message: Schema.String },
  HttpApiSchema.annotations({ status: 500 })
) {}

export class InvalidTransitionError extends Schema.TaggedError<InvalidTransitionError>()(
  'InvalidTransitionError',
  { from: Schema.String, to: Schema.String },
  HttpApiSchema.annotations({ status: 400 })
) {}

export class ExecutionError extends Schema.TaggedError<ExecutionError>()(
  'ExecutionError',
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 500 })
) {}

export class RateLimitError extends Schema.TaggedError<RateLimitError>()(
  'RateLimitError',
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 429 })
) {}
