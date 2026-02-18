import { Workflow } from '@effect/workflow'
import { Schema } from 'effect'

export const GenerationWorkflow = Workflow.make({
  name: 'GenerationWorkflow',
  payload: {
    trackSlug: Schema.String,
    conceptSlug: Schema.String,
    difficulty: Schema.String,
    topic: Schema.optional(Schema.String),
  },
  success: Schema.Struct({
    exerciseId: Schema.optional(Schema.String),
    status: Schema.String,
  }),
  error: Schema.String,
  idempotencyKey: (p) =>
    `gen-${p.trackSlug}-${p.conceptSlug}-${p.difficulty}-${p.topic ?? 'default'}`,
})
