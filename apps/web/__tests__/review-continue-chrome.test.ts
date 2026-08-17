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

  it('a this-sitting pass records the id; a hydrated historical pass does not', () => {
    const page = read('pages/exercise/[exerciseId].vue')
    const review = read('stores/review.ts')
    const exercise = read('stores/exercise.ts')
    expect(review).toContain('applyPassToDueQueue')
    expect(review).toContain('notePassedInSession')
    expect(page).toContain('shouldNoteSittingPass')
    expect(page).toMatch(/shouldNoteSittingPass\([\s\S]*notePassedInSession/)
    // justPassed is the same sitting rule — a hydrated last-week pass must
    // not reopen "How did that come back?"
    expect(page).toMatch(/const justPassed = computed\(\(\) => \{[\s\S]*shouldNoteSittingPass/)
    expect(exercise).toContain('sittingSubmissionIds')
    // loadSubmissions hydrates last week's pass; it must not join the sitting set.
    const loadFn = exercise.slice(exercise.indexOf('async function loadSubmissions'))
    expect(loadFn.slice(0, 400)).not.toContain('sittingSubmissionIds')
    // submitCode must record the id before latestSubmission is assigned,
    // or the status watch fires against an empty sitting set.
    const submitFn = exercise.slice(exercise.indexOf('async function submitCode'))
    const sittingAt = submitFn.indexOf('sittingSubmissionIds')
    const assignAt = submitFn.indexOf('latestSubmission.value = submission')
    expect(sittingAt).toBeGreaterThan(-1)
    expect(assignAt).toBeGreaterThan(-1)
    expect(sittingAt).toBeLessThan(assignAt)
    expect(exercise).toContain('isTerminalSubmissionStatus')
    expect(submitFn).toContain('handleSubmissionComplete()')
  })

  it('post-pass "that was the last one" is not chained to the tutorial link', () => {
    const source = read('pages/exercise/[exerciseId].vue')
    expect(source).not.toMatch(/v-if="conceptTutorial"[\s\S]{0,400}v-else-if="whatsNext"/)
    expect(source).toContain('shouldShowTrackFinished')
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
