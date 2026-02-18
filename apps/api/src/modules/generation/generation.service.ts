import { Context, Effect, HashMap, Layer, Option, Ref } from 'effect'

export interface GenerateExerciseInput {
  trackSlug: string
  conceptSlug: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  topic?: string | undefined
}

interface JobState {
  readonly status: string
  readonly progress: number
  readonly result: unknown
  readonly failedReason: string | null
}

interface GenerationServiceShape {
  readonly queueExerciseGeneration: (
    input: GenerateExerciseInput
  ) => Effect.Effect<{ jobId: string; status: 'queued' }>
  readonly getJobStatus: (jobId: string) => Effect.Effect<{
    jobId: string
    status: string
    progress: number
    result: unknown
    failedReason: string | null
  } | null>
}

export class GenerationService extends Context.Tag('GenerationService')<
  GenerationService,
  GenerationServiceShape
>() {}

export const GenerationServiceLive = Layer.effect(
  GenerationService,
  Effect.gen(function* () {
    // In-memory job tracking using Effect Ref + HashMap for safe concurrent access
    const jobs = yield* Ref.make(HashMap.empty<string, JobState>())

    return GenerationService.of({
      queueExerciseGeneration: (input) =>
        Effect.gen(function* () {
          const jobId = `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`
          yield* Ref.update(jobs, (map) =>
            HashMap.set(map, jobId, {
              status: 'queued',
              progress: 0,
              result: null,
              failedReason: null,
            })
          )

          // TODO: Connect to @effect/workflow when generation workflow is implemented
          return { jobId, status: 'queued' as const }
        }),

      getJobStatus: (jobId) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(jobs)
          const job = Option.getOrNull(HashMap.get(current, jobId))
          return job
            ? {
                jobId,
                status: job.status,
                progress: job.progress,
                result: job.result,
                failedReason: job.failedReason,
              }
            : null
        }),
    })
  })
)
