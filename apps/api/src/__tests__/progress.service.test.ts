import { Test, type TestingModule } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DRIZZLE } from '../database/drizzle.provider.js'
import { ProgressService } from '../modules/progress/progress.service.js'

describe('ProgressService', () => {
  let service: ProgressService
  let mockDb: {
    query: {
      submissions: {
        findMany: ReturnType<typeof vi.fn>
      }
      userProgress: {
        findMany: ReturnType<typeof vi.fn>
      }
    }
  }

  beforeEach(async () => {
    mockDb = {
      query: {
        submissions: {
          findMany: vi.fn(),
        },
        userProgress: {
          findMany: vi.fn(),
        },
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile()

    service = module.get<ProgressService>(ProgressService)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 30 days of activity with counts', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-03T12:00:00Z'))

    mockDb.query.submissions.findMany.mockResolvedValue([
      { createdAt: new Date('2026-02-03T05:00:00Z') },
      { createdAt: new Date('2026-02-02T23:00:00Z') },
    ])
    mockDb.query.userProgress.findMany.mockResolvedValue([
      { completedAt: new Date('2026-02-03T03:00:00Z') },
      { completedAt: new Date('2026-01-25T10:00:00Z') },
    ])

    const result = await service.getActivityTimeline('user-1')

    expect(result).toHaveLength(30)
    expect(result[0]?.date).toBe('2026-01-05')
    expect(result[result.length - 1]?.date).toBe('2026-02-03')

    const feb3 = result.find((entry) => entry.date === '2026-02-03')
    const feb2 = result.find((entry) => entry.date === '2026-02-02')
    const jan25 = result.find((entry) => entry.date === '2026-01-25')

    expect(feb3).toEqual({
      date: '2026-02-03',
      submissions: 1,
      exercisesCompleted: 1,
    })
    expect(feb2).toEqual({
      date: '2026-02-02',
      submissions: 1,
      exercisesCompleted: 0,
    })
    expect(jan25).toEqual({
      date: '2026-01-25',
      submissions: 0,
      exercisesCompleted: 1,
    })
  })
})
