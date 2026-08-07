import { describe, expect, it } from 'vitest'
import {
  canRevealTests,
  canSpendTurn,
  canSubmit,
  type SessionState,
  summarise,
  turnsRemaining,
} from '../server/utils/turn-session'

const session = (over: Partial<SessionState> = {}): SessionState => ({
  status: 'open',
  maxTurns: 3,
  turnsUsed: 0,
  revealedAt: null,
  ...over,
})

describe('turnsRemaining', () => {
  it('counts down as turns are spent', () => {
    expect(turnsRemaining(session({ turnsUsed: 1 }))).toBe(2)
  })

  it('never goes negative', () => {
    // A row can end up past its budget through a retry or a race; the answer is
    // still "none left" rather than a negative that reads as credit.
    expect(turnsRemaining(session({ turnsUsed: 5 }))).toBe(0)
  })
})

describe('canSpendTurn', () => {
  it('allows a turn while budget remains', () => {
    const decision = canSpendTurn(session({ turnsUsed: 2 }), 'try again')
    expect(decision.ok).toBe(true)
    expect(decision.ok && decision.value.turnsAfter).toBe(3)
  })

  it('refuses once the budget is spent', () => {
    const decision = canSpendTurn(session({ turnsUsed: 3 }), 'one more')
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('no-turns-left')
  })

  it('charges for the last turn on the way in, not on the way out', () => {
    // Counting after the model replies makes the final turn free, which turns a
    // budget of three into a budget of four.
    const third = canSpendTurn(session({ turnsUsed: 2 }), 'last one')
    expect(third.ok).toBe(true)
    expect(canSpendTurn(session({ turnsUsed: 3 }), 'sneak').ok).toBe(false)
  })

  it('refuses an empty message without charging for it', () => {
    const decision = canSpendTurn(session(), '   ')
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('empty-message')
  })

  it('refuses on a session that is already finished', () => {
    const decision = canSpendTurn(session({ status: 'submitted' }), 'hello')
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('session-closed')
  })

  it('refuses on an abandoned session', () => {
    expect(canSpendTurn(session({ status: 'abandoned' }), 'hello').ok).toBe(false)
  })
})

describe('canSubmit', () => {
  it('is allowed with turns still in hand', () => {
    expect(canSubmit(session({ turnsUsed: 1 })).ok).toBe(true)
  })

  it('is still allowed after the budget is gone', () => {
    // Running out of turns must not take the decision to submit away: deciding
    // the code is good enough is most of what the exercise is about.
    expect(canSubmit(session({ turnsUsed: 3 })).ok).toBe(true)
  })

  it('is refused twice on the same session', () => {
    const decision = canSubmit(session({ status: 'submitted' }))
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('session-closed')
  })
})

describe('canRevealTests', () => {
  it('refuses while the session is open', () => {
    // The one rule the exercise cannot survive losing: visible tests get pasted
    // to the model, and then the skill being practised is pasting.
    const decision = canRevealTests(session())
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('not-revealed')
  })

  it('refuses on an open session even with turns exhausted', () => {
    expect(canRevealTests(session({ turnsUsed: 3 })).ok).toBe(false)
  })

  it('refuses on a closed session that was never stamped', () => {
    // Closed is not the same as released. Without the stamp, a status written
    // by some other path would open the tests as a side effect.
    expect(canRevealTests(session({ status: 'submitted', revealedAt: null })).ok).toBe(false)
  })

  it('allows once the session is closed and stamped', () => {
    expect(canRevealTests(session({ status: 'submitted', revealedAt: new Date(0) })).ok).toBe(true)
  })

  it('allows on an abandoned session that was stamped', () => {
    expect(canRevealTests(session({ status: 'abandoned', revealedAt: new Date(0) })).ok).toBe(true)
  })
})

describe('summarise', () => {
  it('reports what was spared, not just whether it passed', () => {
    // Two of three is a better result than three of three, and a summary that
    // drops that teaches the opposite of the lesson.
    expect(summarise(session({ turnsUsed: 2 }), true)).toEqual({
      passed: true,
      turnsUsed: 2,
      maxTurns: 3,
      turnsSpared: 1,
    })
  })

  it('reports a failure that used everything', () => {
    expect(summarise(session({ turnsUsed: 3 }), false)).toEqual({
      passed: false,
      turnsUsed: 3,
      maxTurns: 3,
      turnsSpared: 0,
    })
  })
})
