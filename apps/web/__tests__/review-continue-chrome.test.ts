import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The two Continues have to stay distinct in the source the user clicks.
 * A structural check, because this repo has no in-repo e2e suite.
 */

const web = process.cwd()

function read(rel: string): string {
  return readFileSync(join(web, rel), 'utf-8')
}

describe('Review and post-pass Continue chrome', () => {
  it('the Review tab labels due recall separately from something new', () => {
    const source = read('pages/review.vue')
    expect(source).toContain("dueExercises.length > 0 ? 'due recall' : 'review'")
    expect(source).toContain('Review again:')
    expect(source).toContain('Something new:')
    expect(source).toContain('dropPassedFromDue')
    expect(source).toContain('passedThisSession')
    expect(source).toContain('void refresh()')
  })

  it('post-pass Continue uses the shared selector labels, not a generic Continue', () => {
    const source = read('pages/exercise/[exerciseId].vue')
    expect(source).toContain('continueChrome')
    expect(source).toContain('nextKind')
    expect(source).toContain('due-recall')
    expect(source).toContain('TaskBriefPanel')
    expect(source).not.toMatch(/<Button size="sm">Continue<\/Button>/)
  })

  it('the Nitro handlers call the same selector the tests drive', () => {
    const next = read('server/routes/api/exercises/[id]/next.get.ts')
    const cont = read('server/routes/api/exercises/continue.get.ts')
    expect(next).toContain('selectContinueTarget')
    expect(cont).toContain('selectContinueTarget')
    expect(next).toContain('justPassedId: id')
    expect(cont).toContain('completedIds:')
  })
})
