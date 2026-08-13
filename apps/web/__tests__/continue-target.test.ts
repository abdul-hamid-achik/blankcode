import { describe, expect, it } from 'vitest'
import {
  applyPassToDueQueue,
  continueChrome,
  dropPassedFromDue,
  selectContinueTarget,
  shouldShowTrackFinished,
  type ContinueCandidate,
} from '../utils/continue-target'

/**
 * Continue / "what's next" is the path the Review tab and the post-pass
 * button share. These fixtures are the sitting the bug report describes:
 * several due reviews, a just-passed item, and completed neighbours sitting
 * next to new material in the same track.
 */

const dueA: ContinueCandidate = {
  id: 'due-a',
  title: 'Review: pagination drops a page',
  conceptName: 'Code Review',
  trackName: 'TypeScript',
}

const dueB: ContinueCandidate = {
  id: 'due-b',
  title: 'Review: a truncate that corrupts text',
  conceptName: 'Code Review',
  trackName: 'TypeScript',
}

const dueC: ContinueCandidate = {
  id: 'due-c',
  title: 'Review: a debounce that fires twice',
  conceptName: 'Code Review',
  trackName: 'TypeScript',
}

const done1: ContinueCandidate = {
  id: 'done-1',
  title: 'Optional types',
  conceptName: 'Basics',
  trackName: 'TypeScript',
}

const done2: ContinueCandidate = {
  id: 'done-2',
  title: 'Union narrowing',
  conceptName: 'Basics',
  trackName: 'TypeScript',
}

const unseen: ContinueCandidate = {
  id: 'new-1',
  title: 'Generic identity',
  conceptName: 'Generics',
  trackName: 'TypeScript',
}

const track = [done1, done2, unseen]

describe('selectContinueTarget', () => {
  it('after a due review is passed, the next target is another still-due item', () => {
    const result = selectContinueTarget({
      due: [dueA, dueB, dueC],
      justPassedId: dueA.id,
      track,
      completedIds: new Set([dueA.id, dueB.id, dueC.id, done1.id, done2.id]),
    })

    expect(result.kind).toBe('due-recall')
    expect(result.next?.id).toBe(dueB.id)
    expect(result.next?.id).not.toBe(dueA.id)
  })

  it('when nothing is due, Continue is the first exercise this user has not completed', () => {
    const result = selectContinueTarget({
      due: [],
      justPassedId: done2.id,
      track,
      completedIds: new Set([done1.id, done2.id]),
    })

    expect(result.kind).toBe('new-material')
    expect(result.next?.id).toBe(unseen.id)
  })

  it('never returns a completed track neighbour as next', () => {
    const result = selectContinueTarget({
      due: [],
      justPassedId: done1.id,
      track,
      completedIds: new Set([done1.id, done2.id]),
    })

    expect(result.next?.id).not.toBe(done1.id)
    expect(result.next?.id).not.toBe(done2.id)
    expect(result.next?.id).toBe(unseen.id)
  })

  it('reports none when the track has nothing left unpublished to this user', () => {
    const result = selectContinueTarget({
      due: [],
      justPassedId: unseen.id,
      track,
      completedIds: new Set([done1.id, done2.id, unseen.id]),
    })

    expect(result).toEqual({ kind: 'none', next: null })
  })

  it('empty-queue Continue still skips the just-passed item even if completedIds is stale', () => {
    const result = selectContinueTarget({
      due: [],
      justPassedId: done1.id,
      track,
      completedIds: new Set(),
    })

    expect(result.next?.id).toBe(done2.id)
    expect(result.next?.id).not.toBe(done1.id)
  })
})

describe('continueChrome', () => {
  it('names due recall and new material differently', () => {
    expect(continueChrome('due-recall').eyebrow).toBe('due recall')
    expect(continueChrome('due-recall').verb).toBe('Review again')
    expect(continueChrome('new-material').eyebrow).toBe('new material')
    expect(continueChrome('new-material').verb).toBe('Something new')
  })
})

describe('dropPassedFromDue', () => {
  it('removes a just-passed due item from a stale Review payload', () => {
    const remaining = dropPassedFromDue([dueA, dueB, dueC], new Set([dueA.id]))
    expect(remaining.map((item) => item.id)).toEqual([dueB.id, dueC.id])
  })

  it('leaves the queue alone when nothing in this sitting has been passed', () => {
    const remaining = dropPassedFromDue([dueA, dueB], new Set())
    expect(remaining).toEqual([dueA, dueB])
  })
})

describe('applyPassToDueQueue', () => {
  const sitting = {
    dueExercises: [dueA, dueB, dueC],
    dueCount: 3,
    completedThisSession: 0,
    passedThisSession: [] as string[],
  }

  it('on a pass without a rating, a stale Review payload no longer lists that item', () => {
    // Continue-without-rating is the shipped onward path. The id has to land
    // in passedThisSession here, not later in completeReview.
    const afterPass = applyPassToDueQueue(sitting, dueA.id)
    const stalePayload = [dueA, dueB, dueC]
    const remaining = dropPassedFromDue(stalePayload, new Set(afterPass.passedThisSession))

    expect(afterPass.passedThisSession).toContain(dueA.id)
    expect(afterPass.dueExercises.map((item) => item.id)).toEqual([dueB.id, dueC.id])
    expect(remaining.map((item) => item.id)).toEqual([dueB.id, dueC.id])
    expect(afterPass.dueCount).toBe(2)
    expect(afterPass.completedThisSession).toBe(1)
  })

  it('is a no-op the second time, so a later rating does not drop a second due item', () => {
    const once = applyPassToDueQueue(sitting, dueA.id)
    const twice = applyPassToDueQueue(once, dueA.id)
    expect(twice.dueCount).toBe(once.dueCount)
    expect(twice.completedThisSession).toBe(once.completedThisSession)
    expect(twice.passedThisSession).toEqual(once.passedThisSession)
  })
})

describe('shouldShowTrackFinished', () => {
  it('is false when Continue has a next exercise — even if whatsNext itself is set', () => {
    expect(
      shouldShowTrackFinished({
        next: { id: 'due-b' },
        track: { slug: 'typescript', name: 'TypeScript' },
      })
    ).toBe(false)
  })

  it('is true only when the selector honestly returned none', () => {
    expect(
      shouldShowTrackFinished({
        next: null,
        track: { slug: 'typescript', name: 'TypeScript' },
      })
    ).toBe(true)
    expect(shouldShowTrackFinished(null)).toBe(false)
  })
})
