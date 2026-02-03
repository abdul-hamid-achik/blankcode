import { describe, it, expect } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe, createZodPipe } from '../common/pipes/index.js'

describe('ZodValidationPipe', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
  })

  it('transforms valid input', () => {
    const pipe = new ZodValidationPipe(testSchema)
    const input = { name: 'John', age: 30 }

    const result = pipe.transform(input)

    expect(result).toEqual(input)
  })

  it('throws BadRequestException for invalid input', () => {
    const pipe = new ZodValidationPipe(testSchema)
    const input = { name: '', age: -5 }

    expect(() => pipe.transform(input)).toThrow(BadRequestException)
  })

  it('includes validation errors in exception', () => {
    const pipe = new ZodValidationPipe(testSchema)
    const input = { name: '', age: -5 }

    try {
      pipe.transform(input)
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      const response = (error as BadRequestException).getResponse() as {
        message: string
        errors: Array<{ path: string; message: string }>
      }
      expect(response.message).toBe('Validation failed')
      expect(response.errors.length).toBeGreaterThan(0)
    }
  })
})

describe('createZodPipe', () => {
  it('creates a ZodValidationPipe', () => {
    const schema = z.object({ id: z.string() })
    const pipe = createZodPipe(schema)

    expect(pipe).toBeInstanceOf(ZodValidationPipe)
  })
})
