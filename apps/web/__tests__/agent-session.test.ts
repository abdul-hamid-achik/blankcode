import type { AgentScript } from '@blankcode/shared/types'
import { describe, expect, it } from 'vitest'
import {
  applyDecision,
  applyShowBeat,
  agentTurnsRemaining,
  canDecide,
  canRevealTests,
  canShowNextBeat,
  catchesSeed,
  falseAlarmCount,
  interventionsRemaining,
  scoreSupervision,
  seedVerdict,
  seedWindow,
  summarise,
  type AgentSessionState,
} from '../server/utils/agent-session'

const session = (over: Partial<AgentSessionState> = {}): AgentSessionState => ({
  status: 'open',
  beatIndex: 0,
  maxAgentTurns: 2,
  agentTurnsUsed: 1,
  maxInterventions: 3,
  interventionsUsed: 0,
  events: [],
  revealedAt: null,
  ...over,
})

const script = (over: Partial<AgentScript> = {}): AgentScript => ({
  beats: [
    { say: 'I will tighten the mock.', code: null, run: true },
    { say: 'All tests pass now.', code: null, run: false },
  ],
  seeds: [
    {
      at: 0,
      kind: 'wrong-diagnosis',
      window: 1,
      weight: 2,
      truth: 'forEach discarded the promises',
      caught: [],
      missed: [],
    },
    {
      at: 1,
      kind: 'hallucinated-pass',
      window: 1,
      weight: 3,
      truth: 'no run backs the claim',
      caught: [],
      missed: [],
    },
  ],
  rubric: [{ id: 'final-call', weight: 3 }],
  ...over,
})

describe('budgets', () => {
  it('counts interventions down and never goes negative', () => {
    expect(interventionsRemaining(session({ interventionsUsed: 1 }))).toBe(2)
    expect(interventionsRemaining(session({ interventionsUsed: 9 }))).toBe(0)
  })

  it('counts agent turns the same way', () => {
    expect(agentTurnsRemaining(session({ agentTurnsUsed: 1 }))).toBe(1)
    expect(agentTurnsRemaining(session({ agentTurnsUsed: 5 }))).toBe(0)
  })
})

describe('canDecide', () => {
  it('lets approve through without charging', () => {
    const decision = canDecide(session(), 'approve')
    expect(decision.ok).toBe(true)
    expect(decision.ok && decision.value.interventionsAfter).toBe(0)
  })

  it('charges a costing action on the way in', () => {
    const decision = canDecide(session(), 'reject')
    expect(decision.ok).toBe(true)
    expect(decision.ok && decision.value.interventionsAfter).toBe(1)
  })

  it('refuses a costing action once the budget is gone', () => {
    const decision = canDecide(session({ interventionsUsed: 3 }), 'reject')
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('no-interventions-left')
  })

  it('still allows approve when interventions are spent', () => {
    expect(canDecide(session({ interventionsUsed: 3 }), 'approve').ok).toBe(true)
  })

  it('still allows the final call when interventions are spent', () => {
    expect(canDecide(session({ interventionsUsed: 3 }), 'accept-work').ok).toBe(true)
    expect(canDecide(session({ interventionsUsed: 3 }), 'reject-work').ok).toBe(true)
  })

  it('refuses a redirect with no instruction', () => {
    const decision = canDecide(session(), 'redirect', '   ')
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('empty-note')
  })

  it('allows a redirect that actually says something', () => {
    expect(canDecide(session(), 'redirect', 'stop rewriting the mock').ok).toBe(true)
  })

  it('refuses on a closed session', () => {
    const decision = canDecide(session({ status: 'submitted' }), 'approve')
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('session-closed')
  })

  it('refuses a second final call', () => {
    const decided = applyDecision(session(), 'accept-work')
    const again = canDecide(decided, 'reject-work')
    expect(again.ok).toBe(false)
    expect(!again.ok && again.reason).toBe('session-closed')
  })
})

describe('canShowNextBeat', () => {
  it('allows another beat while the agent budget remains', () => {
    const decision = canShowNextBeat(session({ agentTurnsUsed: 1 }))
    expect(decision.ok).toBe(true)
    expect(decision.ok && decision.value.agentTurnsAfter).toBe(2)
  })

  it('refuses once the agent budget is spent', () => {
    const decision = canShowNextBeat(session({ agentTurnsUsed: 2 }))
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('no-agent-turns-left')
  })
})

describe('canRevealTests', () => {
  it('refuses while the session is open', () => {
    const decision = canRevealTests(session())
    expect(decision.ok).toBe(false)
    expect(!decision.ok && decision.reason).toBe('not-revealed')
  })

  it('allows once closed and stamped', () => {
    expect(canRevealTests(session({ status: 'submitted', revealedAt: new Date(0) })).ok).toBe(true)
  })
})

describe('applyDecision', () => {
  it('records an approve without spending an intervention and advances the beat', () => {
    const next = applyDecision(session(), 'approve')
    expect(next.interventionsUsed).toBe(0)
    expect(next.beatIndex).toBe(1)
    expect(next.events).toEqual([{ type: 'decision', action: 'approve', beatIndex: 0 }])
  })

  it('records a reject and spends one intervention', () => {
    const next = applyDecision(session(), 'reject')
    expect(next.interventionsUsed).toBe(1)
    expect(next.events[0]).toMatchObject({ action: 'reject', beatIndex: 0 })
  })

  it('closes on accept-work without advancing the beat', () => {
    const next = applyDecision(session({ beatIndex: 1 }), 'accept-work')
    expect(next.status).toBe('submitted')
    expect(next.beatIndex).toBe(1)
    expect(next.events).toEqual([{ type: 'final', action: 'accept-work' }])
  })
})

describe('applyShowBeat', () => {
  it('increments the agent turn counter only', () => {
    const next = applyShowBeat(session({ agentTurnsUsed: 1 }))
    expect(next.agentTurnsUsed).toBe(2)
    expect(next.beatIndex).toBe(0)
  })
})

describe('catchesSeed', () => {
  it('maps each seed kind to the intervention that catches it', () => {
    expect(catchesSeed('wrong-diagnosis', 'reject')).toBe(true)
    expect(catchesSeed('wrong-diagnosis', 'approve')).toBe(false)
    expect(catchesSeed('hallucinated-pass', 'demand-evidence')).toBe(true)
    expect(catchesSeed('hallucinated-pass', 'reject')).toBe(true)
    expect(catchesSeed('budget-burner', 'interrupt')).toBe(true)
    expect(catchesSeed('confident-invention', 'reject')).toBe(true)
  })
})

describe('seedVerdict', () => {
  const authored = script()
  const diagnosis = authored.seeds[0]!
  const hallucinated = authored.seeds[1]!

  it('puts a window-1 seed on a single beat', () => {
    expect(seedWindow(diagnosis)).toEqual({ start: 0, end: 0 })
    expect(seedWindow({ ...hallucinated, window: 2, at: 0 })).toEqual({ start: 0, end: 1 })
  })

  it('is caught when the right action lands inside the window', () => {
    expect(seedVerdict(diagnosis, [{ type: 'decision', action: 'reject', beatIndex: 0 }])).toBe(
      'caught'
    )
  })

  it('is missed when the supervisor approves the seeded beat', () => {
    expect(seedVerdict(diagnosis, [{ type: 'decision', action: 'approve', beatIndex: 0 }])).toBe(
      'missed'
    )
  })

  it('is late when the right action arrives after the window', () => {
    expect(seedVerdict(diagnosis, [{ type: 'decision', action: 'reject', beatIndex: 1 }])).toBe(
      'late'
    )
  })

  it('is caught on a hallucinated pass by demanding evidence', () => {
    expect(
      seedVerdict(hallucinated, [
        { type: 'decision', action: 'approve', beatIndex: 0 },
        { type: 'decision', action: 'demand-evidence', beatIndex: 1 },
      ])
    ).toBe('caught')
  })
})

describe('falseAlarmCount', () => {
  it('ignores interventions that land on a live seed', () => {
    expect(falseAlarmCount(script(), [{ type: 'decision', action: 'reject', beatIndex: 0 }])).toBe(
      0
    )
  })

  it('counts a costing action on a healthy beat', () => {
    const healthy = script({ seeds: [script().seeds[1]!] })
    expect(falseAlarmCount(healthy, [{ type: 'decision', action: 'reject', beatIndex: 0 }])).toBe(1)
  })

  it('does not count approve as an alarm', () => {
    const healthy = script({ seeds: [] })
    expect(falseAlarmCount(healthy, [{ type: 'decision', action: 'approve', beatIndex: 0 }])).toBe(
      0
    )
  })
})

describe('scoreSupervision', () => {
  it('awards a clean sitting that caught both seeds and accepted passing work', () => {
    const report = scoreSupervision(
      script(),
      [
        { type: 'decision', action: 'reject', beatIndex: 0 },
        { type: 'decision', action: 'demand-evidence', beatIndex: 1 },
        { type: 'final', action: 'accept-work' },
      ],
      true
    )
    // 2 + 3 + 2 (no false alarms) + 3 (final) = 10 / 10
    expect(report.score).toBe(10)
    expect(report.maxScore).toBe(10)
    expect(report.passed).toBe(true)
    expect(report.seeds.map((seed) => seed.verdict)).toEqual(['caught', 'caught'])
  })

  it('halves a late catch and still can pass if the rest is clean', () => {
    const report = scoreSupervision(
      script(),
      [
        { type: 'decision', action: 'approve', beatIndex: 0 },
        { type: 'decision', action: 'reject', beatIndex: 1 },
        { type: 'final', action: 'accept-work' },
      ],
      true
    )
    // diagnosis late: floor(2/2)=1; hallucinated caught: 3; false alarms 2; final 3 → 9/10
    expect(report.seeds[0]?.awarded).toBe(1)
    expect(report.seeds[1]?.awarded).toBe(3)
    expect(report.score).toBe(9)
    expect(report.passed).toBe(true)
  })

  it('fails an accepted hallucinated pass even with a high raw score', () => {
    const report = scoreSupervision(
      script(),
      [
        { type: 'decision', action: 'reject', beatIndex: 0 },
        { type: 'decision', action: 'approve', beatIndex: 1 },
        { type: 'final', action: 'accept-work' },
      ],
      false
    )
    // seeds 2 + 0, false alarms 2, final accept-on-fail 0 → 4/10, and final wrong
    expect(report.finalCallCorrect).toBe(false)
    expect(report.finalCallAwarded).toBe(0)
    expect(report.passed).toBe(false)
  })

  it('gives suspicion a smaller price than credulity when rejecting passing work', () => {
    const report = scoreSupervision(
      script({ seeds: [] }),
      [{ type: 'final', action: 'reject-work' }],
      true
    )
    expect(report.finalCallAwarded).toBe(1)
    expect(report.finalCallCorrect).toBe(false)
    expect(report.passed).toBe(false)
  })

  it('subtracts each false alarm from the calibration weight', () => {
    const healthy = script({ seeds: [] })
    const report = scoreSupervision(
      healthy,
      [
        { type: 'decision', action: 'reject', beatIndex: 0 },
        { type: 'decision', action: 'interrupt', beatIndex: 1 },
        { type: 'final', action: 'accept-work' },
      ],
      true
    )
    expect(report.falseAlarms).toBe(2)
    expect(report.falseAlarmAwarded).toBe(0)
    // 0 seeds + 0 calibration + 3 final = 3/5 = 0.6, below 0.7
    expect(report.passed).toBe(false)
  })
})

describe('summarise', () => {
  it('carries the score next to how much supervision was spent', () => {
    const sitting = session({ interventionsUsed: 2 })
    const report = scoreSupervision(
      script(),
      [
        { type: 'decision', action: 'reject', beatIndex: 0 },
        { type: 'decision', action: 'demand-evidence', beatIndex: 1 },
        { type: 'final', action: 'accept-work' },
      ],
      true
    )
    expect(summarise(sitting, report)).toEqual({
      passed: true,
      score: 10,
      maxScore: 10,
      interventionsUsed: 2,
      maxInterventions: 3,
    })
  })
})
