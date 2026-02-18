import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'
import { AuthRateLimit } from '../middleware/rate-limit.middleware.js'
import { BadRequestError, ConflictError, UnauthorizedError } from './errors.js'

const AuthTokenResponse = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    email: Schema.String,
    username: Schema.String,
    displayName: Schema.NullOr(Schema.String),
  }),
  accessToken: Schema.String,
  refreshToken: Schema.String,
  refreshTokenExpiresAt: Schema.Date,
})

const RegisterPayload = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  username: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(30),
    Schema.pattern(/^[a-zA-Z0-9_-]+$/)
  ),
  password: Schema.String.pipe(Schema.minLength(8), Schema.maxLength(100)),
  displayName: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))),
})

const LoginPayload = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(1)),
})

const RefreshPayload = Schema.Struct({
  refreshToken: Schema.String,
})

export class AuthApi extends HttpApiGroup.make('auth')
  .add(
    HttpApiEndpoint.post('register', '/auth/register')
      .setPayload(RegisterPayload)
      .addSuccess(AuthTokenResponse)
      .addError(ConflictError)
      .addError(BadRequestError)
      .addError(UnauthorizedError)
      .middleware(AuthRateLimit)
  )
  .add(
    HttpApiEndpoint.post('login', '/auth/login')
      .setPayload(LoginPayload)
      .addSuccess(AuthTokenResponse)
      .addError(UnauthorizedError)
      .addError(BadRequestError)
      .middleware(AuthRateLimit)
  )
  .add(
    HttpApiEndpoint.post('refresh', '/auth/refresh')
      .setPayload(RefreshPayload)
      .addSuccess(AuthTokenResponse)
      .addError(UnauthorizedError)
      .addError(BadRequestError)
      .middleware(AuthRateLimit)
  )
  .add(
    HttpApiEndpoint.post('logout', '/auth/logout')
      .setPayload(RefreshPayload)
      .addSuccess(Schema.Void, { status: 204 })
      .addError(BadRequestError)
      .middleware(AuthRateLimit)
  ) {}
