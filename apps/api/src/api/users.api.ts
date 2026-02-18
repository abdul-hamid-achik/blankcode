import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { Authorization } from '../middleware/auth.middleware.js'
import { BadRequestError, NotFoundError } from './errors.js'

const UserResponse = Schema.Struct({
  id: Schema.String,
  email: Schema.optional(Schema.String),
  username: Schema.String,
  displayName: Schema.NullOr(Schema.String),
  avatarUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.optional(Schema.DateFromSelf),
})

const UpdateUserPayload = Schema.Struct({
  displayName: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))),
  avatarUrl: Schema.optional(
    Schema.String.pipe(Schema.pattern(/^https:\/\//), Schema.maxLength(2048))
  ),
})

export class UsersApi extends HttpApiGroup.make('users')
  .add(HttpApiEndpoint.get('getMe', '/users/me').addSuccess(UserResponse).addError(NotFoundError))
  .add(
    HttpApiEndpoint.get('getByUsername')`/users/${HttpApiSchema.param('username', Schema.String)}`
      .addSuccess(UserResponse)
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.patch('updateMe', '/users/me')
      .setPayload(UpdateUserPayload)
      .addSuccess(UserResponse)
      .addError(BadRequestError)
      .addError(NotFoundError)
  )
  .middleware(Authorization) {}
