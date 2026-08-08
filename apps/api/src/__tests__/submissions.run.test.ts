import { Drizzle } from '@blankcode/db/client'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BadRequestError, NotFoundError } from '../api/errors.js'

/**
 * runOnly is the iterate step: execute against the real suite, record nothing
 * but the metering row. These tests pin the three promises that make it safe
 * to expose to agents: no submission/progress/SM-2 writes, its own daily
 * budget, and execution failure surfacing as a result instead of a 500.
 */

vi.mock('../services/execution/index.js', () => ({
  executionService: { execute: vi.fn() },
}))

import {
  SubmissionsService,
  SubmissionsServiceLive,
} from '../modules/submissions/submissions.service.js'
import { executionService } from '../services/execution/index.js'

const executeMock = vi.mocked(executionService.execute)

const exercise = {
  id: 'exercise-1',
  isPublished: true,
  testCode: 'the hidden suite',
  type: 'challenge',
  concept: { track: { slug: 'typescript' } },
}

const passedResult = {
  success: true,
  status: 'passed' as const,
  testResults: [{ name: 'adds', passed: true, message: null, duration: 3 }],
  executionTimeMs: 1200,
}

function createMockDb({ runsUsed = 0 }: { runsUsed?: number } = {}) {
  const whereCount = vi.fn(async () => [{ n: runsUsed }])
  const valuesFn = vi.fn(async () => undefined)
  return {
    query: {
      exercises: { findFirst: vi.fn(async () => exercise) },
      users: {
        findFirst: vi.fn(async () => ({
          subscriptionStatus: null,
          subscriptionEndsAt: null,
        })),
      },
    },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: whereCount })) })),
    insert: vi.fn(() => ({ values: valuesFn })),
    _mocks: { whereCount, valuesFn },
  }
}

type MockDb = ReturnType<typeof createMockDb>

function layerFor(mockDb: MockDb) {
  return SubmissionsServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as never)))
}

async function runOnly(mockDb: MockDb, exerciseId = 'exercise-1') {
  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const svc = yield* SubmissionsService
      return yield* svc.runOnly('user-1', { exerciseId, code: 'const x = 1' })
    }).pipe(Effect.provide(layerFor(mockDb)))
  )
  if (Exit.isSuccess(exit)) return exit.value
  if (Cause.isFailType(exit.cause)) throw exit.cause.error
  throw new Error('Unexpected effect failure')
}

describe('SubmissionsService.runOnly', () => {
  beforeEach(() => {
    executeMock.mockReset()
    executeMock.mockResolvedValue(passedResult)
  })

  it('executes against the suite and records nothing but the metering row', async () => {
    const mockDb = createMockDb()
    const result = await runOnly(mockDb)

    expect(result.status).toBe('passed')
    expect(result.testResults).toEqual(passedResult.testResults)
    expect(result.executionTimeMs).toBe(1200)

    // The real suite and the track's language reached the executor.
    const [, exerciseId, code, testCode, language] = executeMock.mock.calls[0]!
    expect(exerciseId).toBe('exercise-1')
    expect(code).toBe('const x = 1')
    expect(testCode).toBe('the hidden suite')
    expect(language).toBe('typescript')

    // One insert: the usage event. No submission row, no progress, no SM-2.
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(mockDb._mocks.valuesFn).toHaveBeenCalledWith({
      userId: 'user-1',
      kind: 'practice_run',
    })
  })

  it('tells a free account how many runs the day has left', async () => {
    const result = await runOnly(createMockDb({ runsUsed: 4 }))
    // 20 - 4 used - this one = 15.
    expect(result.runsRemainingToday).toBe(15)
  })

  it('refuses at the daily cap without booting a VM', async () => {
    const mockDb = createMockDb({ runsUsed: 20 })
    await expect(runOnly(mockDb)).rejects.toBeInstanceOf(BadRequestError)
    expect(executeMock).not.toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('does not meter a paid account', async () => {
    const mockDb = createMockDb()
    mockDb.query.users.findFirst.mockResolvedValue({
      subscriptionStatus: 'active',
      subscriptionEndsAt: null,
    } as never)

    const result = await runOnly(mockDb)
    expect(result.runsRemainingToday).toBeNull()
    // No count taken — unmetered means unmetered, not counted-and-ignored.
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('refuses an unpublished exercise', async () => {
    const mockDb = createMockDb()
    mockDb.query.exercises.findFirst.mockResolvedValue({
      ...exercise,
      isPublished: false,
    } as never)
    await expect(runOnly(mockDb)).rejects.toBeInstanceOf(NotFoundError)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('surfaces an execution crash as an error result, not a failure', async () => {
    executeMock.mockRejectedValue(new Error('the sandbox vanished'))
    const result = await runOnly(createMockDb())
    expect(result.status).toBe('error')
    expect(result.errorMessage).toContain('the sandbox vanished')
    expect(result.testResults).toEqual([])
  })
})
