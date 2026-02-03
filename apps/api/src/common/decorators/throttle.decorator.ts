import { Throttle, SkipThrottle } from '@nestjs/throttler'

export const AuthThrottle = () =>
  Throttle({ auth: { limit: 5, ttl: 60000 } })

export const SubmissionThrottle = () =>
  Throttle({ submission: { limit: 30, ttl: 60000 } })

export const NoThrottle = () => SkipThrottle()
