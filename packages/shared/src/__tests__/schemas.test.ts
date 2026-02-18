import { Either, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  conceptCreateSchema,
  difficultySchema,
  exerciseCreateSchema,
  exerciseFrontmatterSchema,
  paginationSchema,
  submissionCreateSchema,
  trackCreateSchema,
  userCreateSchema,
  userLoginSchema,
  userUpdateSchema,
} from '../schemas/index.js'

function decode<A, I>(schema: Schema.Schema<A, I>) {
  return (input: unknown) => Schema.decodeUnknownEither(schema)(input)
}

describe('userCreateSchema', () => {
  it('validates a valid user creation input', () => {
    const result = decode(userCreateSchema)({
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      displayName: 'Test User',
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = decode(userCreateSchema)({
      email: 'invalid-email',
      username: 'testuser',
      password: 'password123',
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects username with invalid characters', () => {
    const result = decode(userCreateSchema)({
      email: 'test@example.com',
      username: 'test user!',
      password: 'password123',
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects short username', () => {
    const result = decode(userCreateSchema)({
      email: 'test@example.com',
      username: 'ab',
      password: 'password123',
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects short password', () => {
    const result = decode(userCreateSchema)({
      email: 'test@example.com',
      username: 'testuser',
      password: 'short',
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('allows optional displayName', () => {
    const result = decode(userCreateSchema)({
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    })
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('userLoginSchema', () => {
  it('validates valid login input', () => {
    const result = decode(userLoginSchema)({
      email: 'test@example.com',
      password: 'anypassword',
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects missing email', () => {
    const result = decode(userLoginSchema)({ password: 'anypassword' })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects empty password', () => {
    const result = decode(userLoginSchema)({
      email: 'test@example.com',
      password: '',
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('userUpdateSchema', () => {
  it('validates displayName update', () => {
    const result = decode(userUpdateSchema)({ displayName: 'New Name' })
    expect(Either.isRight(result)).toBe(true)
  })

  it('validates avatarUrl update', () => {
    const result = decode(userUpdateSchema)({ avatarUrl: 'https://example.com/avatar.png' })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects invalid URL', () => {
    const result = decode(userUpdateSchema)({ avatarUrl: 'not-a-url' })
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('trackCreateSchema', () => {
  it('validates valid track input', () => {
    const result = decode(trackCreateSchema)({
      slug: 'typescript',
      name: 'TypeScript',
      description: 'Learn TypeScript',
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects invalid slug', () => {
    const result = decode(trackCreateSchema)({
      slug: 'invalid-slug',
      name: 'Test',
      description: 'Test',
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('uses default values', () => {
    const result = decode(trackCreateSchema)({
      slug: 'typescript',
      name: 'TypeScript',
      description: 'Learn TypeScript',
    })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.order).toBe(0)
      expect(result.right.isPublished).toBe(false)
    }
  })
})

describe('conceptCreateSchema', () => {
  it('validates valid concept input', () => {
    const result = decode(conceptCreateSchema)({
      trackId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'async-patterns',
      name: 'Async Patterns',
      description: 'Learn async patterns',
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects invalid trackId UUID', () => {
    const result = decode(conceptCreateSchema)({
      trackId: 'not-a-uuid',
      slug: 'async-patterns',
      name: 'Async Patterns',
      description: 'Learn async patterns',
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects slug with uppercase', () => {
    const result = decode(conceptCreateSchema)({
      trackId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'Async-Patterns',
      name: 'Async Patterns',
      description: 'Learn async patterns',
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('exerciseCreateSchema', () => {
  it('validates valid exercise input', () => {
    const result = decode(exerciseCreateSchema)({
      conceptId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'ts-async-001',
      title: 'Basic Promise',
      description: 'Learn promises',
      difficulty: 'beginner',
      starterCode: 'function foo() {}',
      solutionCode: 'function foo() { return 1 }',
      testCode: 'expect(foo()).toBe(1)',
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('validates all difficulty levels', () => {
    const difficulties = ['beginner', 'intermediate', 'advanced', 'expert']
    for (const difficulty of difficulties) {
      const result = decode(exerciseCreateSchema)({
        conceptId: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'test',
        title: 'Test',
        description: 'Test',
        difficulty,
        starterCode: 'code',
        solutionCode: 'code',
        testCode: 'code',
      })
      expect(Either.isRight(result)).toBe(true)
    }
  })

  it('rejects invalid difficulty', () => {
    const result = decode(exerciseCreateSchema)({
      conceptId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'test',
      title: 'Test',
      description: 'Test',
      difficulty: 'easy',
      starterCode: 'code',
      solutionCode: 'code',
      testCode: 'code',
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('submissionCreateSchema', () => {
  it('validates valid submission', () => {
    const result = decode(submissionCreateSchema)({
      exerciseId: '550e8400-e29b-41d4-a716-446655440000',
      code: 'function solution() { return 42 }',
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects empty code', () => {
    const result = decode(submissionCreateSchema)({
      exerciseId: '550e8400-e29b-41d4-a716-446655440000',
      code: '',
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('paginationSchema', () => {
  it('uses default values', () => {
    const result = decode(paginationSchema)({})
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.page).toBe(1)
      expect(result.right.limit).toBe(20)
    }
  })

  it('coerces string values', () => {
    const result = decode(paginationSchema)({ page: '5', limit: '50' })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.page).toBe(5)
      expect(result.right.limit).toBe(50)
    }
  })

  it('rejects limit over 100', () => {
    const result = decode(paginationSchema)({ page: '1', limit: '150' })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects non-positive page', () => {
    const result = decode(paginationSchema)({ page: '0', limit: '20' })
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('exerciseFrontmatterSchema', () => {
  it('validates valid frontmatter', () => {
    const result = decode(exerciseFrontmatterSchema)({
      slug: 'ts-async-001',
      title: 'Basic Promise',
      description: 'Learn promises',
      difficulty: 'beginner',
      hints: ['Hint 1', 'Hint 2'],
      tags: ['async', 'promises'],
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('allows optional hints and tags', () => {
    const result = decode(exerciseFrontmatterSchema)({
      slug: 'ts-async-001',
      title: 'Basic Promise',
      description: 'Learn promises',
      difficulty: 'beginner',
    })
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('difficultySchema', () => {
  it('validates all difficulty levels', () => {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert']
    for (const level of levels) {
      const result = decode(difficultySchema)(level)
      expect(Either.isRight(result)).toBe(true)
    }
  })

  it('rejects invalid levels', () => {
    const result = decode(difficultySchema)('easy')
    expect(Either.isLeft(result)).toBe(true)
  })
})
