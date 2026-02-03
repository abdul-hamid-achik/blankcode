import { describe, it, expect, vi } from 'vitest'
import { HttpException, HttpStatus } from '@nestjs/common'
import { ZodError, z } from 'zod'
import { AllExceptionsFilter } from '../common/filters/index.js'

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter()

  const createMockHost = () => {
    const mockResponse = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
      }),
      response: mockResponse,
    }
  }

  it('handles HttpException', () => {
    const host = createMockHost()
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND)

    filter.catch(exception, host as any)

    expect(host.response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
    expect(host.response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Not Found',
        }),
      })
    )
  })

  it('handles ZodError', () => {
    const host = createMockHost()
    const schema = z.object({ name: z.string() })
    let zodError: ZodError
    try {
      schema.parse({ name: 123 })
    } catch (e) {
      zodError = e as ZodError
    }

    filter.catch(zodError!, host as any)

    expect(host.response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(host.response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'BAD_REQUEST',
          message: 'Validation error',
          details: expect.objectContaining({
            issues: expect.any(Array),
          }),
        }),
      })
    )
  })

  it('handles generic Error', () => {
    const host = createMockHost()
    const exception = new Error('Something went wrong')

    filter.catch(exception, host as any)

    expect(host.response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR
    )
    expect(host.response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Something went wrong',
        }),
      })
    )
  })

  it('handles unknown exception types', () => {
    const host = createMockHost()
    const exception = 'string error'

    filter.catch(exception, host as any)

    expect(host.response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR
    )
  })
})
