import { describe, it, expect, vi } from 'vitest'
import { useAsync } from '@/composables/use-async'

describe('useAsync', () => {
  it('initializes with null data and no loading', () => {
    const asyncFn = vi.fn().mockResolvedValue('result')
    const { data, isLoading, error } = useAsync(asyncFn)

    expect(data.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('executes immediately when immediate is true', async () => {
    const asyncFn = vi.fn().mockResolvedValue('result')
    useAsync(asyncFn, true)

    await vi.waitFor(() => {
      expect(asyncFn).toHaveBeenCalled()
    })
  })

  it('does not execute immediately when immediate is false', () => {
    const asyncFn = vi.fn().mockResolvedValue('result')
    useAsync(asyncFn, false)

    expect(asyncFn).not.toHaveBeenCalled()
  })

  describe('execute', () => {
    it('sets isLoading during execution', async () => {
      let resolvePromise: (value: string) => void
      const asyncFn = vi.fn().mockImplementation(
        () => new Promise((resolve) => {
          resolvePromise = resolve
        })
      )

      const { isLoading, execute } = useAsync(asyncFn)
      const promise = execute()

      expect(isLoading.value).toBe(true)

      resolvePromise!('result')
      await promise

      expect(isLoading.value).toBe(false)
    })

    it('sets data on success', async () => {
      const asyncFn = vi.fn().mockResolvedValue('result')
      const { data, execute } = useAsync(asyncFn)

      await execute()

      expect(data.value).toBe('result')
    })

    it('returns data on success', async () => {
      const asyncFn = vi.fn().mockResolvedValue('result')
      const { execute } = useAsync(asyncFn)

      const result = await execute()

      expect(result).toBe('result')
    })

    it('sets error on failure', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'))
      const { error, execute } = useAsync(asyncFn)

      await execute()

      expect(error.value).toBeInstanceOf(Error)
      expect(error.value?.message).toBe('Failed')
    })

    it('returns null on failure', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'))
      const { execute } = useAsync(asyncFn)

      const result = await execute()

      expect(result).toBeNull()
    })

    it('clears previous error on new execution', async () => {
      const asyncFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success')

      const { error, execute } = useAsync(asyncFn)

      await execute()
      expect(error.value).not.toBeNull()

      await execute()
      expect(error.value).toBeNull()
    })

    it('passes arguments to async function', async () => {
      const asyncFn = vi.fn().mockResolvedValue('result')
      const { execute } = useAsync(asyncFn)

      await execute('arg1', 'arg2')

      expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('handles non-Error exceptions', async () => {
      const asyncFn = vi.fn().mockRejectedValue('string error')
      const { error, execute } = useAsync(asyncFn)

      await execute()

      expect(error.value).toBeInstanceOf(Error)
      expect(error.value?.message).toBe('string error')
    })
  })
})
