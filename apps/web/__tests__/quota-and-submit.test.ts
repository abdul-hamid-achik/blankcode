import { describe, expect, it } from 'vitest'
import { practiceQuotaLine } from '../utils/quota-line'
import { isTerminalSubmissionStatus } from '~/utils/submission-status'
import {
  editorFooterShortcut,
  runShortcutLabel,
  submitShortcutLabel,
} from '../utils/submit-shortcut'
import { isResetClaims, RESET_PURPOSE } from '../utils/password-reset'

describe('practiceQuotaLine', () => {
  it('is silent for a paid account', () => {
    expect(
      practiceQuotaLine({
        paid: true,
        submissionsRemaining: 99,
        submissionsLimit: 99,
        runsRemaining: 99,
        runsLimit: 99,
      })
    ).toBeNull()
  })

  it('states remaining submits and runs for a free account', () => {
    expect(
      practiceQuotaLine({
        paid: false,
        submissionsRemaining: 7,
        submissionsLimit: 10,
        runsRemaining: 14,
        runsLimit: 20,
      })
    ).toBe('7 of 10 submits left today · 14 runs')
  })
})

describe('isTerminalSubmissionStatus', () => {
  it('treats an inline createAndExecute result as done', () => {
    expect(isTerminalSubmissionStatus('passed')).toBe(true)
    expect(isTerminalSubmissionStatus('failed')).toBe(true)
    expect(isTerminalSubmissionStatus('error')).toBe(true)
    expect(isTerminalSubmissionStatus('pending')).toBe(false)
    expect(isTerminalSubmissionStatus('running')).toBe(false)
  })
})

describe('shortcut labels', () => {
  it('uses the command glyph on Mac and Ctrl elsewhere', () => {
    expect(submitShortcutLabel('MacIntel')).toBe('⌘↵')
    expect(submitShortcutLabel('Win32')).toBe('Ctrl+↵')
    expect(runShortcutLabel('MacIntel')).toBe('⌘⇧↵')
    expect(runShortcutLabel('Linux x86_64')).toBe('Ctrl+Shift+↵')
    expect(editorFooterShortcut('MacIntel')).toContain('⌘↵')
    expect(editorFooterShortcut('MacIntel')).toContain('⌘⇧↵')
  })
})

describe('isResetClaims', () => {
  it('accepts only a password-reset purpose with a subject and email', () => {
    expect(isResetClaims({ sub: 'user-1', email: 'a@b.c', purpose: RESET_PURPOSE })).toBe(true)
    expect(isResetClaims({ sub: 'user-1', email: 'a@b.c', purpose: 'session' })).toBe(false)
    expect(isResetClaims({ email: 'a@b.c', purpose: RESET_PURPOSE })).toBe(false)
  })
})
