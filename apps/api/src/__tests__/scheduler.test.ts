import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateNextReview } from '../modules/reviews/scheduler.js'

describe('calculateNextReview (SM-2 scheduler)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('first successful review', () => {
    it('should schedule interval of 1 day for first successful review', () => {
      const result = calculateNextReview(4, 1, 0, 2.5)
      expect(result.intervalDays).toBe(1)
      expect(result.repetitions).toBe(1)
      expect(result.nextReviewAt).toBeInstanceOf(Date)
    })
  })

  describe('second successful review', () => {
    it('should schedule interval of 3 days for second successful review', () => {
      const result = calculateNextReview(4, 1, 1, 2.5)
      expect(result.intervalDays).toBe(3)
      expect(result.repetitions).toBe(2)
    })
  })

  describe('third successful review', () => {
    it('should calculate interval as 3 * easeFactor for third review', () => {
      const result = calculateNextReview(4, 3, 2, 2.5)
      expect(result.intervalDays).toBe(Math.round(3 * 2.5))
      expect(result.repetitions).toBe(3)
    })
  })

  describe('failed review', () => {
    it('should reset to 1 day interval', () => {
      const result = calculateNextReview(1, 10, 5, 2.5)
      expect(result.intervalDays).toBe(1)
      expect(result.repetitions).toBe(0)
    })

    it('should decrease ease factor but not below 1.3', () => {
      const result = calculateNextReview(1, 10, 5, 1.5)
      expect(result.easeFactor).toBe(1.3)
    })

    it('should decrease ease factor from default 2.5 by 0.2', () => {
      const result = calculateNextReview(1, 10, 5, 2.5)
      expect(result.easeFactor).toBe(2.3)
    })
  })

  describe('hard quality (3)', () => {
    it('should multiply interval by 0.8', () => {
      const result = calculateNextReview(3, 10, 3, 2.5)
      // newEaseFactor = 2.5 + (0.1 - 2*(0.08 + 2*0.02)) = 2.5 - 0.16 = 2.44
      // intervalDays = Math.round(10 * 2.44) = 24
      // then multiply by 0.8: Math.round(24 * 0.8) = 19
      expect(result.intervalDays).toBe(19)
    })
  })

  describe('easy quality (5)', () => {
    it('should multiply interval by 1.3', () => {
      const result = calculateNextReview(5, 10, 3, 2.5)
      // newEaseFactor = 2.5 + 0.1 = 2.6
      // intervalDays = Math.round(10 * 2.6) = 26
      // then multiply by 1.3: Math.round(26 * 1.3) = 34
      expect(result.intervalDays).toBe(34)
    })
  })

  describe('ease factor adjustment', () => {
    it('should increase ease factor for quality > 4', () => {
      const result = calculateNextReview(5, 10, 3, 2.5)
      expect(result.easeFactor).toBeGreaterThan(2.5)
    })

    it('should decrease ease factor for quality < 4', () => {
      const result = calculateNextReview(3, 10, 3, 2.5)
      expect(result.easeFactor).toBeLessThan(2.5)
    })
  })

  describe('boundary conditions', () => {
    it('should not allow ease factor below 1.3', () => {
      const result = calculateNextReview(0, 1, 0, 1.3)
      expect(result.easeFactor).toBe(1.3)
    })
  })
})
