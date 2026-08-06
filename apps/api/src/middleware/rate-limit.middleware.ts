import { HttpApiMiddleware, HttpServerRequest } from '@effect/platform'
import { Effect, HashMap, Layer, Option, Ref } from 'effect'
import { RateLimitError } from '../api/errors.js'
import { config } from '../config/index.js'

const TRUST_FORWARDED_FOR = process.env['TRUST_FORWARDED_FOR'] === 'true'
const MAX_RATE_LIMIT_KEYS = 10_000

function getClientIp(req: HttpServerRequest.HttpServerRequest): string {
  if (TRUST_FORWARDED_FOR) {
    const xff = req.headers['x-forwarded-for']
    if (typeof xff === 'string' && xff.length > 0) {
      const first = xff.split(',')[0]?.trim()
      if (first) return first
    }
  }
  return Option.getOrElse(req.remoteAddress, () => 'unknown')
}

function pruneIfOversized(
  map: HashMap.HashMap<string, number[]>
): HashMap.HashMap<string, number[]> {
  if (HashMap.size(map) <= MAX_RATE_LIMIT_KEYS) return map
  // Clear when oversized — safer than letting it grow unbounded under burst.
  return HashMap.empty()
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
          const updated = HashMap.set(map, ip, [...valid, now])
          const pruned = HashMap.filter(updated, (ts) => ts.some((t) => t > windowStart))
          return pruneIfOversized(pruned)
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
          const updated = HashMap.set(map, ip, [...valid, now])
          const pruned = HashMap.filter(updated, (ts) => ts.some((t) => t > windowStart))
          return pruneIfOversized(pruned)
        })
      })
    )
  })
)
