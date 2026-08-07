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

/**
 * The typecheck gate concatenates the solution and the test into one module, so
 * a binding imported by both would be declared twice. Dropping the test's whole
 * import statement fixes that and breaks something worse: a test importing
 * `nextTick` from 'vue' loses it because the solution imported `ref` from the
 * same module, and the exercise fails with "Cannot find name 'nextTick'" —
 * which reads as a broken exercise rather than a broken harness.
 */
describe('import dedupe for the typecheck gate', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/services/execution/executors/typescript.executor.ts'),
    'utf-8'
  )

  it('keeps bindings the solution did not import', () => {
    // The rewrite must reconstruct the statement from the surviving names
    // rather than return the line unchanged or drop it.
    expect(source).toContain('kept.length === 0')
    expect(source).toContain('kept.join')
  })

  it('still drops a binding both sides import', () => {
    expect(source).toContain('already.has(name)')
  })

  it('handles `type` and `as` in a clause', () => {
    // `import { type Ref }` and `import { ref as r }` name `Ref` and `ref`;
    // comparing the raw text would miss both.
    expect(source).toContain("replace(/^type\\s+/, '')")
    expect(source).toContain('split(/\\sas\\s/)')
  })
})
