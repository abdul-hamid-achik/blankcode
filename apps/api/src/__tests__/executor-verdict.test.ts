import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Zero tests must never be reported as a pass.
 *
 * `[].every(...)` is `true`, so every executor used to return
 * `status: 'passed'` when the parser extracted no results and the process
 * happened to exit 0. The UI showed "Passed (0/0 tests passed)", the exercise
 * was marked complete, mastery went up, and SM-2 scheduled it forward — all
 * from a run that verified nothing.
 *
 * This is a source-level guard because the executors shell out to Docker and
 * cannot be exercised in a unit test.
 */

const EXECUTOR_DIR = join(process.cwd(), 'src/services/execution/executors')
const EXECUTORS = ['typescript', 'python', 'go', 'rust'] as const

describe('executor verdicts', () => {
  it.each(EXECUTORS)('%s.executor.ts guards against an empty result set', (name) => {
    const source = readFileSync(join(EXECUTOR_DIR, `${name}.executor.ts`), 'utf-8')

    const guardIndex = source.indexOf('testResults.length === 0')
    const verdictIndex = source.indexOf('testResults.every((r) => r.passed)')

    expect(guardIndex, `${name}: no empty-result guard found`).toBeGreaterThan(-1)
    expect(verdictIndex, `${name}: no verdict computation found`).toBeGreaterThan(-1)

    // The guard has to run *before* the verdict, or it cannot prevent the
    // false pass.
    const guardsBeforeVerdict = source.slice(0, verdictIndex).includes('testResults.length === 0')
    expect(guardsBeforeVerdict, `${name}: guard must precede the pass/fail decision`).toBe(true)
  })

  it.each(EXECUTORS)('%s.executor.ts never reports success on an empty run', (name) => {
    const source = readFileSync(join(EXECUTOR_DIR, `${name}.executor.ts`), 'utf-8')
    const verdictIndex = source.indexOf('testResults.every((r) => r.passed)')

    // Everything between the last empty-result guard and the verdict must not
    // resolve to a passing status.
    const guardBlockStart = source.lastIndexOf('testResults.length === 0', verdictIndex)
    const between = source.slice(guardBlockStart, verdictIndex)

    expect(between).toContain("status: 'error'")
    expect(between).toContain('success: false')
  })
})
