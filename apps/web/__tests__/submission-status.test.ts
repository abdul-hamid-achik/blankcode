import type { SubmissionStatus } from '@blankcode/shared'
import { describe, expect, it } from 'vitest'
import { getStatusClasses, getStatusLabel, statusConfig } from '~/utils/submission-status'

const ALL_STATUSES: SubmissionStatus[] = ['pending', 'running', 'passed', 'failed', 'error']

describe('submission status mapping', () => {
  it('covers every status the API can return', () => {
    for (const status of ALL_STATUSES) {
      expect(statusConfig[status]).toBeDefined()
    }
    expect(Object.keys(statusConfig).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('gives each status a human label', () => {
    expect(getStatusLabel('pending')).toBe('Pending')
    expect(getStatusLabel('running')).toBe('Running')
    expect(getStatusLabel('passed')).toBe('Passed')
    expect(getStatusLabel('failed')).toBe('Failed')
    expect(getStatusLabel('error')).toBe('Error')
  })

  it('falls back to the error styling for an unknown status', () => {
    // The API contract could grow a status the frontend has not shipped yet;
    // that must not render an undefined class string into the DOM.
    const classes = getStatusClasses('queued' as SubmissionStatus)
    expect(classes).toEqual(statusConfig.error)
  })

  it('echoes an unknown status back as its own label', () => {
    expect(getStatusLabel('queued' as SubmissionStatus)).toBe('queued')
  })

  it('never emits an empty class string', () => {
    for (const status of ALL_STATUSES) {
      const classes = getStatusClasses(status)
      expect(classes.colorClass.length).toBeGreaterThan(0)
      expect(classes.bgClass.length).toBeGreaterThan(0)
    }
  })
})
