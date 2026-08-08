import { Drizzle } from '@blankcode/db/client'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ReflectionsService,
  ReflectionsServiceLive,
} from '../modules/reflections/reflections.service.js'

/**
 * The reflect → SM-2 seam: recording a reflection is also what releases an
 * unexplained-pass hold on the review schedule — but only a substantive one,
 * and never at the cost of the reflection row itself.
 */

const SUBSTANTIVE =
  'The forEach callback returned promises nobody awaited, so the function resolved before any save landed.'
const HOLLOW = 'makes sense'

function createMockDb() {
  return {
    query: {
      exercises: {
        findFirst: vi.fn().mockResolvedValue({ id: 'ex-1' }),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'refl-1',
            exerciseId: 'ex-1',
            question: 'q',
            answer: 'a',
            createdAt: new Date(),
          },
        ]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  }
}

function makeLayer(mockDb: ReturnType<typeof createMockDb>) {
  return ReflectionsServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as never)))
}

async function run<A, E>(
  effect: Effect.Effect<A, E, ReflectionsService>,
  layer: Layer.Layer<ReflectionsService>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  if (Cause.isFailType(cause)) throw cause.error
  throw new Error('Unexpected effect failure')
}

function create(answer: string) {
  return Effect.gen(function* () {
    const svc = yield* ReflectionsService
    return yield* svc.create('user-1', { exerciseId: 'ex-1', question: 'Why is it right?', answer })
  })
}

describe('ReflectionsService.create and the review hold', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    mockDb = createMockDb()
  })

  it('a substantive answer releases the held schedule', async () => {
    const row = await run(create(SUBSTANTIVE), makeLayer(mockDb))
    expect(row.id).toBe('refl-1')

    expect(mockDb.update).toHaveBeenCalledTimes(1)
    const set = mockDb.update.mock.results[0]?.value.set
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ heldNextReviewAt: null }))
  })

  it('a hollow answer records the reflection and leaves the hold alone', async () => {
    const row = await run(create(HOLLOW), makeLayer(mockDb))
    expect(row.id).toBe('refl-1')
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('a failed release does not take the reflection down with it', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('db blip')),
      }),
    })
    const row = await run(create(SUBSTANTIVE), makeLayer(mockDb))
    expect(row.id).toBe('refl-1')
  })

  it('an empty answer is refused outright', async () => {
    await expect(run(create('   '), makeLayer(mockDb))).rejects.toMatchObject({
      message: expect.stringContaining('real answer'),
    })
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})
