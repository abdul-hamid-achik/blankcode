import { Context, Effect, Layer } from 'effect'
import * as jose from 'jose'
import { UnauthorizedError } from '../api/errors.js'
import { config } from '../config/index.js'

export interface JwtPayload {
  sub: string
  email: string
}

export class JwtService extends Context.Tag('JwtService')<
  JwtService,
  {
    readonly sign: (payload: JwtPayload) => Effect.Effect<string, UnauthorizedError>
    readonly verify: (token: string) => Effect.Effect<JwtPayload, UnauthorizedError>
  }
>() {}

export const JwtServiceLive = Layer.succeed(JwtService, {
  sign: (payload) =>
    Effect.tryPromise({
      try: () =>
        new jose.SignJWT({ email: payload.email })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(payload.sub)
          .setIssuedAt()
          .setExpirationTime(config.jwt.expiresIn)
          .sign(new TextEncoder().encode(config.jwt.secret)),
      catch: () => new UnauthorizedError({ message: 'Failed to sign token' }),
    }),

  verify: (token) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => jose.jwtVerify(token, new TextEncoder().encode(config.jwt.secret)),
        catch: () => new UnauthorizedError({ message: 'Invalid or expired token' }),
      })
      const sub = result.payload.sub
      const email = result.payload['email'] as string | undefined
      if (!sub || !email) {
        return yield* Effect.fail(new UnauthorizedError({ message: 'Invalid token payload' }))
      }
      return { sub, email }
    }),
})
