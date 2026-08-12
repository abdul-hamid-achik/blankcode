/**
 * Pure bits of the supervision sitting. The Vue surface talks to $fetch;
 * these stay testable without mounting Nuxt.
 */

export interface TestRow {
  name: string
  passed: boolean
  message: string | null
}

export function budgetSlots(used: number, max: number): boolean[] {
  return Array.from({ length: Math.max(0, max) }, (_, i) => i < used)
}

export function actionLabel(action: string): string {
  if (action === 'demand-evidence') return 'demanded evidence'
  if (action === 'accept-work') return 'accepted the work'
  if (action === 'reject-work') return 'rejected the work'
  return action
}

export function finalCallCopy(correct: boolean): string {
  return correct
    ? 'The final call matched what the suite actually did.'
    : 'The final call did not match the suite. Accepting a fail is the cardinal miss.'
}

export function falseAlarmCopy(count: number, awarded: number, weight: number): string {
  if (count === 0) {
    return `No false alarms \u2014 ${awarded} / ${weight} on trust calibration.`
  }
  const noun = count === 1 ? 'false alarm' : 'false alarms'
  return `${count} ${noun} on healthy work \u2014 ${awarded} / ${weight} on trust calibration.`
}

export function testsFromEvidence(
  evidence: { testResults?: ReadonlyArray<TestRow> } | null | undefined
): TestRow[] {
  return evidence?.testResults ? [...evidence.testResults] : []
}

export function pendingCopy(kind: 'start' | 'decide' | 'close' | null): string {
  if (kind === 'start') {
    return 'Opening the sitting \u2014 the first run is real and takes a few seconds.'
  }
  if (kind === 'close') return 'Running the suite against the final code\u2026'
  if (kind === 'decide') return 'Working \u2014 a run against the suite can take a few seconds.'
  return ''
}
