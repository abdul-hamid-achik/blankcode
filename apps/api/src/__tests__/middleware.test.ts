import { HttpServerRequest } from '@effect/platform'
import { Cause, Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { RateLimitError, UnauthorizedError } from '../api/errors.js'
import {
  AuthRateLimit,
  AuthRateLimitLive,
  SubmissionRateLimit,
  SubmissionRateLimitLive,
} from '../middleware/rate-limit.middleware.js'
import { JwtService, JwtServiceLive } from '../services/jwt.service.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run an Effect to an Exit and extract the success value, or throw the
 * domain error so vitest `.rejects.toBeInstanceOf(...)` works.
 */
async function run<A, E>(effect: Effect.Effect<A, E, never>): Promise<A>
async function run<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A>
async function run<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect as Effect.Effect<A, E, never>)
  if (Exit.isSuccess(exit)) return exit.value
  if (Cause.isFailType(exit.cause)) throw exit.cause.error
  throw new Error('Unexpected effect failure')
}

/**
 * Build a minimal mock HttpServerRequest with the given remote IP.
 * The rate-limit middleware reads `req.headers['x-forwarded-for']` first,
 * then falls back to `req.remoteAddress`.
 */
function mockHttpRequest(ip: string): HttpServerRequest.HttpServerRequest {
  return {
    headers: {} as any,
    remoteAddress: Option.some(ip),
    method: 'POST',
    url: '/test',
    originalUrl: '/test',
  } as unknown as HttpServerRequest.HttpServerRequest
}

function _mockHttpRequestWithForwarded(forwardedIp: string): HttpServerRequest.HttpServerRequest {
  return {
    headers: { 'x-forwarded-for': forwardedIp } as any,
    remoteAddress: Option.some('127.0.0.1'),
    method: 'POST',
    url: '/test',
    originalUrl: '/test',
  } as unknown as HttpServerRequest.HttpServerRequest
}

// ===========================================================================
// 1. JwtService tests
// ===========================================================================

describe('JwtService', () => {
  const layer = JwtServiceLive

  describe('sign', () => {
    it('produces a JWT string', async () => {
      const token = await run(
        Effect.gen(function* () {
          const jwt = yield* JwtService
          return yield* jwt.sign({ sub: 'user-1', email: 'test@example.com' })
        }).pipe(Effect.provide(layer))
      )

      expect(typeof token).toBe('string')
      // JWTs have three base64url-encoded parts separated by dots
      expect(token.split('.')).toHaveLength(3)
    })
  })

  describe('verify', () => {
    it('decodes a valid token and returns the payload', async () => {
      const payload = await run(
        Effect.gen(function* () {
          const jwt = yield* JwtService
          const token = yield* jwt.sign({ sub: 'user-42', email: 'hello@example.com' })
          return yield* jwt.verify(token)
        }).pipe(Effect.provide(layer))
      )

      expect(payload.sub).toBe('user-42')
      expect(payload.email).toBe('hello@example.com')
    })

    it('fails with UnauthorizedError for an invalid token', async () => {
      await expect(
        run(
          Effect.gen(function* () {
            const jwt = yield* JwtService
            return yield* jwt.verify('not-a-real-jwt')
          }).pipe(Effect.provide(layer))
        )
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('fails with UnauthorizedError for a tampered token', async () => {
      await expect(
        run(
          Effect.gen(function* () {
            const jwt = yield* JwtService
            const token = yield* jwt.sign({ sub: 'user-1', email: 'a@b.com' })
            // Tamper with the payload section
            const parts = token.split('.')
            parts[1] = `${parts[1]!}tampered`
            return yield* jwt.verify(parts.join('.'))
          }).pipe(Effect.provide(layer))
        )
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ===========================================================================
// 2. AuthRateLimit tests (5 requests per 60 s window)
// ===========================================================================

describe('AuthRateLimit', () => {
  /**
   * Build a program that invokes the AuthRateLimit middleware `count` times
   * for the given IP address. Returns the number of successful invocations.
   *
   * AuthRateLimitLive creates the internal Ref store once per layer
   * build, so we get a fresh store per test by building a new layer each time.
   */
  function makeRateLimitProgram(ip: string, count: number) {
    const reqLayer = Layer.succeed(HttpServerRequest.HttpServerRequest, mockHttpRequest(ip))

    // AuthRateLimitLive produces the AuthRateLimit service.
    // The middleware effect itself requires HttpServerRequest in context.
    const fullLayer = Layer.merge(AuthRateLimitLive, reqLayer)

    return Effect.gen(function* () {
      const middleware = yield* AuthRateLimit
      let successes = 0
      for (let i = 0; i < count; i++) {
        const exit = yield* Effect.exit(middleware)
        if (Exit.isSuccess(exit)) successes++
      }
      return successes
    }).pipe(Effect.provide(fullLayer))
  }

  it('allows requests under the limit (5 requests)', async () => {
    const successes = await run(makeRateLimitProgram('10.0.0.1', 5))
    expect(successes).toBe(5)
  })

  it('rejects the 6th request with RateLimitError', async () => {
    const successes = await run(makeRateLimitProgram('10.0.0.2', 6))
    expect(successes).toBe(5)
  })

  it('rejects all excess requests', async () => {
    const successes = await run(makeRateLimitProgram('10.0.0.3', 10))
    expect(successes).toBe(5)
  })

  it('tracks different IPs independently', async () => {
    // Two different IPs should each get their own window
    const reqLayerA = Layer.succeed(
      HttpServerRequest.HttpServerRequest,
      mockHttpRequest('192.168.1.1')
    )
    const reqLayerB = Layer.succeed(
      HttpServerRequest.HttpServerRequest,
      mockHttpRequest('192.168.1.2')
    )

    // Share the same AuthRateLimitLive (same store)
    const program = Effect.gen(function* () {
      const middleware = yield* AuthRateLimit

      // 5 requests from IP A
      let successesA = 0
      for (let i = 0; i < 5; i++) {
        const exit = yield* Effect.exit(Effect.provide(middleware, reqLayerA))
        if (Exit.isSuccess(exit)) successesA++
      }

      // 5 requests from IP B
      let successesB = 0
      for (let i = 0; i < 5; i++) {
        const exit = yield* Effect.exit(Effect.provide(middleware, reqLayerB))
        if (Exit.isSuccess(exit)) successesB++
      }

      // 6th from IP A should fail
      const exitA6 = yield* Effect.exit(Effect.provide(middleware, reqLayerA))

      return { successesA, successesB, a6Failed: Exit.isFailure(exitA6) }
    }).pipe(Effect.provide(AuthRateLimitLive))

    const result = await run(program)
    expect(result.successesA).toBe(5)
    expect(result.successesB).toBe(5)
    expect(result.a6Failed).toBe(true)
  })

  it('ignores x-forwarded-for and uses remoteAddress for rate limiting', async () => {
    // Two requests with DIFFERENT x-forwarded-for headers but the SAME
    // remoteAddress. If the middleware read x-forwarded-for, each would
    // get its own bucket. Since it uses remoteAddress, they share one.
    const sharedRemoteIp = '10.99.0.1'

    const reqWithForwardedA = Layer.succeed(HttpServerRequest.HttpServerRequest, {
      headers: { 'x-forwarded-for': 'spoofed-ip-A' } as Record<string, string>,
      remoteAddress: Option.some(sharedRemoteIp),
      method: 'POST',
      url: '/test',
      originalUrl: '/test',
    } as unknown as HttpServerRequest.HttpServerRequest)
    const reqWithForwardedB = Layer.succeed(HttpServerRequest.HttpServerRequest, {
      headers: { 'x-forwarded-for': 'spoofed-ip-B' } as Record<string, string>,
      remoteAddress: Option.some(sharedRemoteIp),
      method: 'POST',
      url: '/test',
      originalUrl: '/test',
    } as unknown as HttpServerRequest.HttpServerRequest)

    // Build ONE shared AuthRateLimit layer, then run against two request layers
    const program = Effect.gen(function* () {
      const middleware = yield* AuthRateLimit

      // 3 requests from "spoofed-ip-A" (real: sharedRemoteIp)
      let successesA = 0
      for (let i = 0; i < 3; i++) {
        const exit = yield* Effect.exit(
          (
            middleware as Effect.Effect<void, RateLimitError, HttpServerRequest.HttpServerRequest>
          ).pipe(Effect.provide(reqWithForwardedA))
        )
        if (Exit.isSuccess(exit)) successesA++
      }

      // 3 more from "spoofed-ip-B" (real: SAME sharedRemoteIp)
      let successesB = 0
      for (let i = 0; i < 3; i++) {
        const exit = yield* Effect.exit(
          (
            middleware as Effect.Effect<void, RateLimitError, HttpServerRequest.HttpServerRequest>
          ).pipe(Effect.provide(reqWithForwardedB))
        )
        if (Exit.isSuccess(exit)) successesB++
      }

      return { successesA, successesB }
    }).pipe(Effect.provide(AuthRateLimitLive)) as Effect.Effect<
      { successesA: number; successesB: number },
      never,
      never
    >

    const result = await run(program)
    // If x-forwarded-for were used: A gets 3/3, B gets 3/3 (different buckets)
    // Since remoteAddress is used: shared bucket, 5 total allowed
    expect(result.successesA).toBe(3)
    expect(result.successesB).toBe(2) // Only 2 of 3 succeed (5 total)
  })

  it('returns a RateLimitError with the correct message', async () => {
    const reqLayer = Layer.succeed(
      HttpServerRequest.HttpServerRequest,
      mockHttpRequest('10.0.0.99')
    )
    const fullLayer = Layer.merge(AuthRateLimitLive, reqLayer)

    const program = Effect.gen(function* () {
      const middleware = yield* AuthRateLimit
      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        yield* middleware
      }
      // This one should fail
      return yield* middleware
    }).pipe(Effect.provide(fullLayer)) as Effect.Effect<void, RateLimitError, never>

    const exit = await Effect.runPromiseExit(program)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && Cause.isFailType(exit.cause)) {
      const err = exit.cause.error as RateLimitError
      expect(err._tag).toBe('RateLimitError')
      expect(err.message).toBe('Too many auth requests')
    }
  })
})

// ===========================================================================
// 3. SubmissionRateLimit tests (30 requests per 60 s window)
// ===========================================================================

describe('SubmissionRateLimit', () => {
  function makeRateLimitProgram(ip: string, count: number) {
    const reqLayer = Layer.succeed(HttpServerRequest.HttpServerRequest, mockHttpRequest(ip))
    const fullLayer = Layer.merge(SubmissionRateLimitLive, reqLayer)

    return Effect.gen(function* () {
      const middleware = yield* SubmissionRateLimit
      let successes = 0
      for (let i = 0; i < count; i++) {
        const exit = yield* Effect.exit(middleware)
        if (Exit.isSuccess(exit)) successes++
      }
      return successes
    }).pipe(Effect.provide(fullLayer))
  }

  it('allows requests under the limit (30 requests)', async () => {
    const successes = await run(makeRateLimitProgram('10.1.0.1', 30))
    expect(successes).toBe(30)
  })

  it('rejects the 31st request with RateLimitError', async () => {
    const successes = await run(makeRateLimitProgram('10.1.0.2', 31))
    expect(successes).toBe(30)
  })

  it('rejects all excess requests', async () => {
    const successes = await run(makeRateLimitProgram('10.1.0.3', 40))
    expect(successes).toBe(30)
  })

  it('returns a RateLimitError with the correct message', async () => {
    const reqLayer = Layer.succeed(
      HttpServerRequest.HttpServerRequest,
      mockHttpRequest('10.1.0.99')
    )
    const fullLayer = Layer.merge(SubmissionRateLimitLive, reqLayer)

    const program = Effect.gen(function* () {
      const middleware = yield* SubmissionRateLimit
      // Exhaust limit
      for (let i = 0; i < 30; i++) {
        yield* middleware
      }
      // This one should fail
      return yield* middleware
    }).pipe(Effect.provide(fullLayer)) as Effect.Effect<void, RateLimitError, never>

    const exit = await Effect.runPromiseExit(program)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && Cause.isFailType(exit.cause)) {
      const err = exit.cause.error as RateLimitError
      expect(err._tag).toBe('RateLimitError')
      expect(err.message).toBe('Too many submission requests')
    }
  })

  it('tracks different IPs independently', async () => {
    const reqLayerA = Layer.succeed(
      HttpServerRequest.HttpServerRequest,
      mockHttpRequest('172.16.0.1')
    )
    const reqLayerB = Layer.succeed(
      HttpServerRequest.HttpServerRequest,
      mockHttpRequest('172.16.0.2')
    )

    const program = Effect.gen(function* () {
      const middleware = yield* SubmissionRateLimit

      let successesA = 0
      for (let i = 0; i < 30; i++) {
        const exit = yield* Effect.exit(Effect.provide(middleware, reqLayerA))
        if (Exit.isSuccess(exit)) successesA++
      }

      let successesB = 0
      for (let i = 0; i < 30; i++) {
        const exit = yield* Effect.exit(Effect.provide(middleware, reqLayerB))
        if (Exit.isSuccess(exit)) successesB++
      }

      // 31st from IP A should fail
      const exitA31 = yield* Effect.exit(Effect.provide(middleware, reqLayerA))

      return { successesA, successesB, a31Failed: Exit.isFailure(exitA31) }
    }).pipe(Effect.provide(SubmissionRateLimitLive))

    const result = await run(program)
    expect(result.successesA).toBe(30)
    expect(result.successesB).toBe(30)
    expect(result.a31Failed).toBe(true)
  })
})
