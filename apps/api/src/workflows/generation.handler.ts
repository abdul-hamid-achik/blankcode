import { Effect } from 'effect'
import { GenerationWorkflow } from './generation.workflow.js'

export const GenerationWorkflowLive = GenerationWorkflow.toLayer((_payload) =>
  Effect.succeed({
    exerciseId: undefined,
    status: 'not_implemented',
  })
)
