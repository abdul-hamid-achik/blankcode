import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { TracksService } from '../modules/tracks/tracks.service.js'
import { DRIZZLE } from '../database/drizzle.provider.js'

describe('TracksService', () => {
  let service: TracksService
  let mockDb: {
    query: {
      tracks: {
        findMany: ReturnType<typeof vi.fn>
        findFirst: ReturnType<typeof vi.fn>
      }
    }
  }

  const mockTrack = {
    id: 'track-1',
    slug: 'typescript',
    name: 'TypeScript',
    description: 'Learn TypeScript',
    iconUrl: null,
    order: 1,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockConcept = {
    id: 'concept-1',
    trackId: 'track-1',
    slug: 'async-patterns',
    name: 'Async Patterns',
    description: 'Learn async patterns',
    order: 1,
    isPublished: true,
  }

  beforeEach(async () => {
    mockDb = {
      query: {
        tracks: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracksService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile()

    service = module.get<TracksService>(TracksService)
  })

  describe('findAll', () => {
    it('returns all published tracks', async () => {
      mockDb.query.tracks.findMany.mockResolvedValue([mockTrack])

      const result = await service.findAll()

      expect(result).toHaveLength(1)
      expect(result[0]?.slug).toBe('typescript')
    })

    it('returns empty array when no tracks', async () => {
      mockDb.query.tracks.findMany.mockResolvedValue([])

      const result = await service.findAll()

      expect(result).toHaveLength(0)
    })
  })

  describe('findBySlug', () => {
    it('returns track with concepts', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue({
        ...mockTrack,
        concepts: [mockConcept],
      })

      const result = await service.findBySlug('typescript')

      expect(result.slug).toBe('typescript')
      expect(result.concepts).toHaveLength(1)
    })

    it('throws NotFoundException for invalid slug', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(null)

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException
      )
    })
  })

  describe('findById', () => {
    it('returns track by id', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)

      const result = await service.findById('track-1')

      expect(result.id).toBe('track-1')
    })

    it('throws NotFoundException for invalid id', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(null)

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException
      )
    })
  })
})
