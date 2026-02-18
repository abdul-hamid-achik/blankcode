import { describe, expect, it } from 'vitest'
import {
  BadRequestError,
  ConflictError,
  ExecutionError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  QueueError,
  RateLimitError,
  UnauthorizedError,
} from '../api/errors.js'

describe('Domain Errors (Schema.TaggedError)', () => {
  it('NotFoundError has correct tag and fields', () => {
    const err = new NotFoundError({ resource: 'User', id: '123' })
    expect(err._tag).toBe('NotFoundError')
    expect(err.resource).toBe('User')
    expect(err.id).toBe('123')
  })

  it('ConflictError has correct tag', () => {
    const err = new ConflictError({ message: 'Already exists' })
    expect(err._tag).toBe('ConflictError')
    expect(err.message).toBe('Already exists')
  })

  it('UnauthorizedError has correct tag', () => {
    const err = new UnauthorizedError({ message: 'Invalid credentials' })
    expect(err._tag).toBe('UnauthorizedError')
    expect(err.message).toBe('Invalid credentials')
  })

  it('ForbiddenError has correct tag', () => {
    const err = new ForbiddenError({ message: 'Admin access required' })
    expect(err._tag).toBe('ForbiddenError')
  })

  it('BadRequestError has correct tag', () => {
    const err = new BadRequestError({ message: 'Validation failed' })
    expect(err._tag).toBe('BadRequestError')
  })

  it('QueueError has correct tag', () => {
    const err = new QueueError({ submissionId: 'sub-1', message: 'timeout' })
    expect(err._tag).toBe('QueueError')
    expect(err.submissionId).toBe('sub-1')
  })

  it('InvalidTransitionError has correct tag and fields', () => {
    const err = new InvalidTransitionError({ from: 'pending', to: 'passed' })
    expect(err._tag).toBe('InvalidTransitionError')
    expect(err.from).toBe('pending')
    expect(err.to).toBe('passed')
  })

  it('ExecutionError has correct tag', () => {
    const err = new ExecutionError({ message: 'Sandbox failed' })
    expect(err._tag).toBe('ExecutionError')
  })

  it('RateLimitError has correct tag', () => {
    const err = new RateLimitError({ message: 'Too many requests' })
    expect(err._tag).toBe('RateLimitError')
  })
})
