import { Either, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

describe('Effect Schema Validation', () => {
  const testSchema = Schema.Struct({
    name: Schema.String.pipe(Schema.minLength(1)),
    age: Schema.Number.pipe(Schema.positive()),
  })

  it('decodes valid input', () => {
    const input = { name: 'John', age: 30 }
    const result = Schema.decodeUnknownEither(testSchema)(input)

    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right).toEqual(input)
    }
  })

  it('rejects invalid input', () => {
    const input = { name: '', age: -5 }
    const result = Schema.decodeUnknownEither(testSchema)(input)

    expect(Either.isLeft(result)).toBe(true)
  })

  it('returns correct type for valid input', () => {
    const input = { name: 'Alice', age: 25 }
    const result = Schema.decodeUnknownEither(testSchema)(input)

    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.name).toBe('Alice')
      expect(result.right.age).toBe(25)
    }
  })

  it('works with NumberFromString', () => {
    const schema = Schema.Struct({
      limit: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
    })

    const result = Schema.decodeUnknownEither(schema)({ limit: '20' })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.limit).toBe(20)
    }
  })

  it('rejects non-numeric strings for NumberFromString', () => {
    const schema = Schema.Struct({
      limit: Schema.NumberFromString.pipe(Schema.int()),
    })

    const result = Schema.decodeUnknownEither(schema)({ limit: 'abc' })
    expect(Either.isLeft(result)).toBe(true)
  })
})
