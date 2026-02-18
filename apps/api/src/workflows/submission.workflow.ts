import { Workflow } from '@effect/workflow'
import { Schema } from 'effect'

export const SubmissionWorkflow = Workflow.make({
  name: 'SubmissionWorkflow',
  payload: {
    submissionId: Schema.String,
    exerciseId: Schema.String,
    code: Schema.String,
  },
  success: Schema.Struct({
    status: Schema.Literal('passed', 'failed', 'error'),
    testResults: Schema.Array(Schema.Unknown),
    executionTimeMs: Schema.NullOr(Schema.Number),
    errorMessage: Schema.optional(Schema.String),
  }),
  error: Schema.String,
  idempotencyKey: (p) => p.submissionId,
})
