import { HttpApiMiddleware, HttpServerRequest } from '@effect/platform'
import { Effect, HashMap, Layer, Option, Ref } from 'effect'
import { RateLimitError } from '../api/errors.js'
import { config } from '../config/index.js'

function getClientIp(req: HttpServerRequest.HttpServerRequest): string {
  return Option.getOrElse(req.remoteAddress, () => 'unknown')
}

function getTimestamps(map: HashMap.HashMap<string, number[]>, key: string): number[] {
  return Option.getOrElse(HashMap.get(map, key), () => [])
}

// Auth rate limit: reads from config.rateLimit.authLimit / authTtl
export class AuthRateLimit extends HttpApiMiddleware.Tag<AuthRateLimit>()('AuthRateLimit', {
  failure: RateLimitError,
}) {}

export const AuthRateLimitLive = Layer.effect(
  AuthRateLimit,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<string, number[]>())

    return AuthRateLimit.of(
      Effect.gen(function* () {
        const req = yield* HttpServerRequest.HttpServerRequest
        const ip = getClientIp(req)
        const now = Date.now()
        const windowStart = now - config.rateLimit.authTtl

        const current = yield* Ref.get(store)
        const timestamps = getTimestamps(current, ip)
        const valid = timestamps.filter((t) => t > windowStart)

        if (valid.length >= config.rateLimit.authLimit) {
          return yield* Effect.fail(new RateLimitError({ message: 'Too many auth requests' }))
        }

        yield* Ref.update(store, (map) => {
          // Set current IP's timestamps
          const updated = HashMap.set(map, ip, [...valid, now])
          // Prune stale entries where all timestamps have expired
          return HashMap.filter(updated, (ts) => ts.some((t) => t > windowStart))
        })
      })
    )
  })
)

// Submission rate limit: reads from config.rateLimit.submissionLimit / submissionTtl
export class SubmissionRateLimit extends HttpApiMiddleware.Tag<SubmissionRateLimit>()(
  'SubmissionRateLimit',
  { failure: RateLimitError }
) {}

export const SubmissionRateLimitLive = Layer.effect(
  SubmissionRateLimit,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<string, number[]>())

    return SubmissionRateLimit.of(
      Effect.gen(function* () {
        const req = yield* HttpServerRequest.HttpServerRequest
        const ip = getClientIp(req)
        const now = Date.now()
        const windowStart = now - config.rateLimit.submissionTtl

        const current = yield* Ref.get(store)
        const timestamps = getTimestamps(current, ip)
        const valid = timestamps.filter((t) => t > windowStart)

        if (valid.length >= config.rateLimit.submissionLimit) {
          return yield* Effect.fail(new RateLimitError({ message: 'Too many submission requests' }))
        }

        yield* Ref.update(store, (map) => {
          // Set current IP's timestamps
          const updated = HashMap.set(map, ip, [...valid, now])
          // Prune stale entries where all timestamps have expired
          return HashMap.filter(updated, (ts) => ts.some((t) => t > windowStart))
        })
      })
    )
  })
)
