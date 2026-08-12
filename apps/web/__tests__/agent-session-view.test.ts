import { describe, expect, it } from 'vitest'
import {
  actionLabel,
  budgetSlots,
  falseAlarmCopy,
  finalCallCopy,
  pendingCopy,
  testsFromEvidence,
} from '~/utils/agent-session-view'

describe('budgetSlots', () => {
  it('fills from the left and never exceeds the budget', () => {
    expect(budgetSlots(2, 4)).toEqual([true, true, false, false])
    expect(budgetSlots(0, 3)).toEqual([false, false, false])
    expect(budgetSlots(5, 2)).toEqual([true, true])
  })

  it('treats a missing budget as no slots', () => {
    expect(budgetSlots(1, 0)).toEqual([])
    expect(budgetSlots(1, -1)).toEqual([])
  })
})

describe('actionLabel', () => {
  it('speaks the interventions in the sitting voice', () => {
    expect(actionLabel('demand-evidence')).toBe('demanded evidence')
    expect(actionLabel('accept-work')).toBe('accepted the work')
    expect(actionLabel('reject-work')).toBe('rejected the work')
    expect(actionLabel('approve')).toBe('approve')
  })
})

describe('report copy', () => {
  it('names the cardinal miss when the final call is wrong', () => {
    expect(finalCallCopy(false)).toContain('cardinal miss')
    expect(finalCallCopy(true)).toContain('matched')
  })

  it('counts false alarms without blaming a clean sitting', () => {
    expect(falseAlarmCopy(0, 2, 2)).toContain('No false alarms')
    expect(falseAlarmCopy(1, 1, 2)).toContain('1 false alarm')
    expect(falseAlarmCopy(2, 0, 2)).toContain('2 false alarms')
  })
})

describe('testsFromEvidence', () => {
  it('copies the rows so a refresh can rebuild the suite list', () => {
    const rows = [{ name: 'returns the saves', passed: false, message: 'expected 3' }]
    expect(testsFromEvidence({ testResults: rows })).toEqual(rows)
    expect(testsFromEvidence(null)).toEqual([])
  })
})

describe('pendingCopy', () => {
  it('warns that start and close actually run the suite', () => {
    expect(pendingCopy('start')).toContain('first run is real')
    expect(pendingCopy('close')).toContain('final code')
    expect(pendingCopy(null)).toBe('')
  })
})
