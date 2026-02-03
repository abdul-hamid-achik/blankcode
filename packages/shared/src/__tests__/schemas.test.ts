import { describe, it, expect } from 'vitest'
import {
  userCreateSchema,
  userLoginSchema,
  userUpdateSchema,
  trackCreateSchema,
  conceptCreateSchema,
  exerciseCreateSchema,
  submissionCreateSchema,
  paginationSchema,
  exerciseFrontmatterSchema,
  difficultySchema,
} from '../schemas/index.js'

describe('userCreateSchema', () => {
  it('validates a valid user creation input', () => {
    const input = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      displayName: 'Test User',
    }
    const result = userCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const input = {
      email: 'invalid-email',
      username: 'testuser',
      password: 'password123',
    }
    const result = userCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects username with invalid characters', () => {
    const input = {
      email: 'test@example.com',
      username: 'test user!',
      password: 'password123',
    }
    const result = userCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects short username', () => {
    const input = {
      email: 'test@example.com',
      username: 'ab',
      password: 'password123',
    }
    const result = userCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const input = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'short',
    }
    const result = userCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('allows optional displayName', () => {
    const input = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    }
    const result = userCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })
})

describe('userLoginSchema', () => {
  it('validates valid login input', () => {
    const input = {
      email: 'test@example.com',
      password: 'anypassword',
    }
    const result = userLoginSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects missing email', () => {
    const input = {
      password: 'anypassword',
    }
    const result = userLoginSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const input = {
      email: 'test@example.com',
      password: '',
    }
    const result = userLoginSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('userUpdateSchema', () => {
  it('validates displayName update', () => {
    const input = { displayName: 'New Name' }
    const result = userUpdateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('validates avatarUrl update', () => {
    const input = { avatarUrl: 'https://example.com/avatar.png' }
    const result = userUpdateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects invalid URL', () => {
    const input = { avatarUrl: 'not-a-url' }
    const result = userUpdateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('trackCreateSchema', () => {
  it('validates valid track input', () => {
    const input = {
      slug: 'typescript',
      name: 'TypeScript',
      description: 'Learn TypeScript',
    }
    const result = trackCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects invalid slug', () => {
    const input = {
      slug: 'invalid-slug',
      name: 'Test',
      description: 'Test',
    }
    const result = trackCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('uses default values', () => {
    const input = {
      slug: 'typescript',
      name: 'TypeScript',
      description: 'Learn TypeScript',
    }
    const result = trackCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.order).toBe(0)
      expect(result.data.isPublished).toBe(false)
    }
  })
})

describe('conceptCreateSchema', () => {
  it('validates valid concept input', () => {
    const input = {
      trackId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'async-patterns',
      name: 'Async Patterns',
      description: 'Learn async patterns',
    }
    const result = conceptCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects invalid trackId UUID', () => {
    const input = {
      trackId: 'not-a-uuid',
      slug: 'async-patterns',
      name: 'Async Patterns',
      description: 'Learn async patterns',
    }
    const result = conceptCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects slug with uppercase', () => {
    const input = {
      trackId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'Async-Patterns',
      name: 'Async Patterns',
      description: 'Learn async patterns',
    }
    const result = conceptCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('exerciseCreateSchema', () => {
  it('validates valid exercise input', () => {
    const input = {
      conceptId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'ts-async-001',
      title: 'Basic Promise',
      description: 'Learn promises',
      difficulty: 'beginner',
      starterCode: 'function foo() {}',
      solutionCode: 'function foo() { return 1 }',
      testCode: 'expect(foo()).toBe(1)',
    }
    const result = exerciseCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('validates all difficulty levels', () => {
    const difficulties = ['beginner', 'intermediate', 'advanced', 'expert']
    for (const difficulty of difficulties) {
      const input = {
        conceptId: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'test',
        title: 'Test',
        description: 'Test',
        difficulty,
        starterCode: 'code',
        solutionCode: 'code',
        testCode: 'code',
      }
      const result = exerciseCreateSchema.safeParse(input)
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid difficulty', () => {
    const input = {
      conceptId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'test',
      title: 'Test',
      description: 'Test',
      difficulty: 'easy',
      starterCode: 'code',
      solutionCode: 'code',
      testCode: 'code',
    }
    const result = exerciseCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('submissionCreateSchema', () => {
  it('validates valid submission', () => {
    const input = {
      exerciseId: '550e8400-e29b-41d4-a716-446655440000',
      code: 'function solution() { return 42 }',
    }
    const result = submissionCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects empty code', () => {
    const input = {
      exerciseId: '550e8400-e29b-41d4-a716-446655440000',
      code: '',
    }
    const result = submissionCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('paginationSchema', () => {
  it('uses default values', () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('coerces string values', () => {
    const result = paginationSchema.safeParse({ page: '5', limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(5)
      expect(result.data.limit).toBe(50)
    }
  })

  it('rejects limit over 100', () => {
    const result = paginationSchema.safeParse({ limit: 150 })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive page', () => {
    const result = paginationSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })
})

describe('exerciseFrontmatterSchema', () => {
  it('validates valid frontmatter', () => {
    const input = {
      slug: 'ts-async-001',
      title: 'Basic Promise',
      description: 'Learn promises',
      difficulty: 'beginner',
      hints: ['Hint 1', 'Hint 2'],
      tags: ['async', 'promises'],
    }
    const result = exerciseFrontmatterSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('allows optional hints and tags', () => {
    const input = {
      slug: 'ts-async-001',
      title: 'Basic Promise',
      description: 'Learn promises',
      difficulty: 'beginner',
    }
    const result = exerciseFrontmatterSchema.safeParse(input)
    expect(result.success).toBe(true)
  })
})

describe('difficultySchema', () => {
  it('validates all difficulty levels', () => {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert']
    for (const level of levels) {
      const result = difficultySchema.safeParse(level)
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid levels', () => {
    const result = difficultySchema.safeParse('easy')
    expect(result.success).toBe(false)
  })
})
