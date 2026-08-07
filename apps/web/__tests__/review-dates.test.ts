import { describe, expect, it } from 'vitest'
import {
  calendarDaysUntil,
  speakNextBatch,
  speakReturnDay,
  speakSchedule,
} from '../utils/review-dates'

/**
 * "Tomorrow" is a claim about two dates. These pin the clock so the claims
 * can be checked, including the edges where relative words go wrong: late at
 * night, across a week boundary, and exactly seven days out — where a weekday
 * name stops identifying one day and starts identifying two.
 */

// A Wednesday evening, late enough that hour math and calendar math disagree.
const NOW = new Date(2026, 7, 5, 23, 30) // Aug 5 2026, 23:30 local

describe('calendarDaysUntil', () => {
  it('counts calendar days, not 24-hour spans', () => {
    // 26 hours away but only "tomorrow" by the calendar.
    expect(calendarDaysUntil(new Date(2026, 7, 6, 1, 30).toISOString(), NOW)).toBe(1)
  })

  it('is zero for later the same day', () => {
    expect(calendarDaysUntil(new Date(2026, 7, 5, 23, 59).toISOString(), NOW)).toBe(0)
  })
})

describe('speakReturnDay', () => {
  it('says tomorrow across midnight', () => {
    expect(speakReturnDay(new Date(2026, 7, 6, 9, 0).toISOString(), NOW)).toBe('tomorrow')
  })

  it('uses a weekday name inside the coming week', () => {
    // Aug 10 2026 is the coming Monday, five days out.
    expect(speakReturnDay(new Date(2026, 7, 10, 9, 0).toISOString(), NOW)).toBe('on Monday')
  })

  it('switches to a date at seven days, where the weekday becomes ambiguous', () => {
    // Aug 12 is also a Wednesday — "on Wednesday" would mean today's name.
    expect(speakReturnDay(new Date(2026, 7, 12, 9, 0).toISOString(), NOW)).toBe('on Aug 12')
  })

  it('never claims the past; an overdue date reads as today', () => {
    expect(speakReturnDay(new Date(2026, 7, 4, 9, 0).toISOString(), NOW)).toBe('today')
  })
})

describe('speakSchedule', () => {
  it('forms the post-rating sentence', () => {
    expect(speakSchedule(new Date(2026, 7, 13, 9, 0).toISOString(), NOW)).toBe(
      'comes back on Aug 13'
    )
  })
})

describe('speakNextBatch', () => {
  it('is silent when nothing is scheduled', () => {
    expect(speakNextBatch(null, NOW)).toBeNull()
  })

  it('agrees in number', () => {
    expect(speakNextBatch({ date: '2026-08-06', count: 1 }, NOW)).toBe('1 comes back tomorrow')
    expect(speakNextBatch({ date: '2026-08-09', count: 3 }, NOW)).toBe('3 come back on Sunday')
  })
})
