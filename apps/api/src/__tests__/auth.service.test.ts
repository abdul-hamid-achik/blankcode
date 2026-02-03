import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { ConflictException, UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { AuthService } from '../modules/auth/auth.service.js'
import { DRIZZLE } from '../database/drizzle.provider.js'

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}))

describe('AuthService', () => {
  let service: AuthService
  let jwtService: JwtService
  let mockDb: {
    query: {
      users: {
        findFirst: ReturnType<typeof vi.fn>
      }
    }
    insert: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    mockDb = {
      query: {
        users: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'user-1',
              email: 'test@example.com',
              username: 'testuser',
              displayName: 'Test User',
            },
          ]),
        }),
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: vi.fn().mockReturnValue('mock-token'),
          },
        },
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    jwtService = module.get<JwtService>(JwtService)
  })

  describe('register', () => {
    it('creates a new user and returns token', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null)
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never)

      const result = await service.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      })

      expect(result.token).toBe('mock-token')
      expect(result.user).toBeDefined()
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
    })

    it('throws ConflictException if email exists', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({ id: 'existing' })

      await expect(
        service.register({
          email: 'existing@example.com',
          username: 'testuser',
          password: 'password123',
        })
      ).rejects.toThrow(ConflictException)
    })

    it('throws ConflictException if username exists', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' })

      await expect(
        service.register({
          email: 'test@example.com',
          username: 'existinguser',
          password: 'password123',
        })
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('login', () => {
    it('returns user and token for valid credentials', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        passwordHash: 'hashed-password',
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result.token).toBe('mock-token')
      expect(result.user.email).toBe('test@example.com')
    })

    it('throws UnauthorizedException for invalid email', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null)

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(UnauthorizedException)
    })

    it('throws UnauthorizedException for invalid password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('validateUser', () => {
    it('returns user for valid userId', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await service.validateUser('user-1')
      expect(result?.id).toBe('user-1')
    })

    it('returns null for invalid userId', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null)

      const result = await service.validateUser('nonexistent')
      expect(result).toBeNull()
    })
  })
})
