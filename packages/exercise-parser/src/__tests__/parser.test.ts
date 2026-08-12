import { describe, expect, it } from 'vitest'
import {
  BLANK_END_MARKER,
  BLANK_START_MARKER,
  extractAgentScript,
  extractBlanks,
  generateStarterCode,
  parseExercise,
  stripBlankMarkers,
  validateExercise,
} from '../index.js'

describe('parseExercise', () => {
  it('parses a valid exercise markdown', () => {
    const markdown = `---
slug: test-001
title: Test Exercise
description: A test exercise
difficulty: beginner
hints:
  - Hint 1
  - Hint 2
tags:
  - test
---

Complete the code below.

\`\`\`typescript
function greet(name: string): string {
  return ${BLANK_START_MARKER}\`Hello, \${name}!\`${BLANK_END_MARKER};
}
\`\`\`
`
    const result = parseExercise(markdown)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.exercise.frontmatter.slug).toBe('test-001')
      expect(result.exercise.frontmatter.title).toBe('Test Exercise')
      expect(result.exercise.frontmatter.difficulty).toBe('beginner')
      expect(result.exercise.blanks).toHaveLength(1)
    }
  })

  it('returns errors for invalid frontmatter', () => {
    const markdown = `---
title: Missing slug
description: Test
---

\`\`\`typescript
const x = 1;
\`\`\`
`
    const result = parseExercise(markdown)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('returns error when no code block found', () => {
    const markdown = `---
slug: test
title: Test
description: Test
difficulty: beginner
---

No code block here.
`
    const result = parseExercise(markdown)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors).toContain('No code block found in exercise content')
    }
  })

  it('can skip frontmatter validation', () => {
    const markdown = `---
customField: value
---

\`\`\`typescript
const x = ${BLANK_START_MARKER}1${BLANK_END_MARKER};
\`\`\`
`
    const result = parseExercise(markdown, { validateFrontmatter: false })
    expect(result.success).toBe(true)
  })
})

describe('extractBlanks', () => {
  it('extracts single blank', () => {
    const code = `const x = ${BLANK_START_MARKER}42${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    expect(blanks).toHaveLength(1)
    expect(blanks[0]?.solution).toBe('42')
  })

  it('extracts multiple blanks', () => {
    const code = `const x = ${BLANK_START_MARKER}1${BLANK_END_MARKER};
const y = ${BLANK_START_MARKER}2${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    expect(blanks).toHaveLength(2)
    expect(blanks[0]?.solution).toBe('1')
    expect(blanks[1]?.solution).toBe('2')
  })

  it('extracts blank with complex content', () => {
    const code = `return ${BLANK_START_MARKER}\`Hello, \${name}!\`${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    expect(blanks).toHaveLength(1)
    expect(blanks[0]?.solution).toBe('`Hello, ${name}!`')
  })

  it('generates unique IDs', () => {
    const code = `const a = ${BLANK_START_MARKER}1${BLANK_END_MARKER};
const b = ${BLANK_START_MARKER}2${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    expect(blanks[0]?.id).toBe('blank-1')
    expect(blanks[1]?.id).toBe('blank-2')
  })

  it('throws on unclosed blank', () => {
    const code = `const x = ${BLANK_START_MARKER}42;`
    expect(() => extractBlanks(code)).toThrow('Unclosed blank region detected')
  })

  it('records correct positions', () => {
    const code = `const x = ${BLANK_START_MARKER}42${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    expect(blanks[0]?.startLine).toBe(0)
    expect(blanks[0]?.endLine).toBe(0)
  })

  it('generates appropriate placeholders', () => {
    const code = `const x = ${BLANK_START_MARKER}1${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    expect(blanks[0]?.placeholder).toBe('___')
  })

  it('generates longer placeholders for longer solutions', () => {
    const code = `const x = ${BLANK_START_MARKER}longerValue${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    expect(blanks[0]?.placeholder.length).toBeGreaterThan(3)
  })
})

describe('generateStarterCode', () => {
  it('replaces blanks with placeholders', () => {
    const code = `const x = ${BLANK_START_MARKER}42${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    const { starterCode } = generateStarterCode(code, blanks)
    expect(starterCode).not.toContain(BLANK_START_MARKER)
    expect(starterCode).not.toContain(BLANK_END_MARKER)
    expect(starterCode).not.toContain('42')
    expect(starterCode).toContain('___')
  })

  it('preserves non-blank code', () => {
    const code = `const greeting = "hello";
const x = ${BLANK_START_MARKER}42${BLANK_END_MARKER};
console.log(x);`
    const blanks = extractBlanks(code)
    const { starterCode } = generateStarterCode(code, blanks)
    expect(starterCode).toContain('const greeting = "hello"')
    expect(starterCode).toContain('console.log(x)')
  })

  it('handles multiple blanks', () => {
    const code = `const a = ${BLANK_START_MARKER}1${BLANK_END_MARKER};
const b = ${BLANK_START_MARKER}2${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    const { starterCode } = generateStarterCode(code, blanks)
    expect(starterCode).not.toContain('1')
    expect(starterCode).not.toContain('2')
  })

  it('returns blanksInStarter with correct character offsets', () => {
    const code = `const x = ${BLANK_START_MARKER}42${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    const { starterCode, blanksInStarter } = generateStarterCode(code, blanks)
    expect(blanksInStarter).toHaveLength(1)
    const b = blanksInStarter[0]!
    expect(b.id).toBe('blank-1')
    expect(b.solution).toBe('42')
    expect(starterCode.slice(b.from, b.to)).toBe(b.placeholder)
  })

  it('returns correct offsets for multiple blanks', () => {
    const code = `const a = ${BLANK_START_MARKER}1${BLANK_END_MARKER};
const b = ${BLANK_START_MARKER}2${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    const { starterCode, blanksInStarter } = generateStarterCode(code, blanks)
    expect(blanksInStarter).toHaveLength(2)
    for (const b of blanksInStarter) {
      expect(starterCode.slice(b.from, b.to)).toBe(b.placeholder)
    }
    expect(blanksInStarter[0]!.solution).toBe('1')
    expect(blanksInStarter[1]!.solution).toBe('2')
  })
})

describe('validateExercise', () => {
  it('returns empty array for valid exercise', () => {
    const markdown = `---
slug: test-001
title: Test
description: Test
difficulty: beginner
---

\`\`\`typescript
const x = ${BLANK_START_MARKER}1${BLANK_END_MARKER};
\`\`\`
`
    const result = parseExercise(markdown)
    if (result.success) {
      const errors = validateExercise(result.exercise)
      expect(errors).toHaveLength(0)
    }
  })

  it('returns error for exercise without blanks', () => {
    const markdown = `---
slug: test-001
title: Test
description: Test
difficulty: beginner
---

\`\`\`typescript
const x = 1;
\`\`\`
`
    const result = parseExercise(markdown)
    if (result.success) {
      const errors = validateExercise(result.exercise)
      expect(errors).toContain('Blank exercise must have at least one blank region')
    }
  })
})

describe('stripBlankMarkers', () => {
  it('removes all blank markers', () => {
    const code = `const x = ${BLANK_START_MARKER}42${BLANK_END_MARKER};`
    const stripped = stripBlankMarkers(code)
    expect(stripped).toBe('const x = 42;')
    expect(stripped).not.toContain(BLANK_START_MARKER)
    expect(stripped).not.toContain(BLANK_END_MARKER)
  })

  it('handles multiple markers', () => {
    const code = `const a = ${BLANK_START_MARKER}1${BLANK_END_MARKER};
const b = ${BLANK_START_MARKER}2${BLANK_END_MARKER};`
    const stripped = stripBlankMarkers(code)
    expect(stripped).toBe(`const a = 1;
const b = 2;`)
  })

  it('leaves code without markers unchanged', () => {
    const code = 'const x = 42;'
    expect(stripBlankMarkers(code)).toBe(code)
  })
})

describe('markers', () => {
  it('exports correct marker strings', () => {
    expect(BLANK_START_MARKER).toBe('___blank_start___')
    expect(BLANK_END_MARKER).toBe('___blank_end___')
  })
})

/**
 * A challenge's first code block is the stub the learner starts from, not an
 * answer. Before `## Solution` existed, the parser used that stub as
 * `solutionCode`, so every challenge shipped with a reference solution that was
 * a comment — and nothing could verify a challenge was even solvable.
 */
describe('challenge reference solutions', () => {
  const challenge = `---
slug: demo-challenge
title: 'Challenge: Demo'
description: A demo challenge.
difficulty: beginner
type: challenge
---

# Demo

## Requirements

Write \`double\`.

\`\`\`ts
// Your implementation here
\`\`\`

## Tests

\`\`\`ts
import { expect, it } from 'vitest'
it('doubles', () => expect(double(2)).toBe(4))
\`\`\`

## Solution

\`\`\`ts
function double(n: number): number {
  return n * 2
}
\`\`\`
`

  it('takes the starter from the first block and the solution from ## Solution', () => {
    const result = parseExercise(challenge)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.exercise.starterCode).toContain('Your implementation here')
    expect(result.exercise.solutionCode).toContain('return n * 2')
    expect(result.exercise.solutionCode).not.toContain('Your implementation here')
  })

  it('does not pick up a later section as the solution', () => {
    // `## Tests` comes before `## Solution`; the wrong regex would grab it.
    const result = parseExercise(challenge)
    if (!result.success) return
    expect(result.exercise.solutionCode).not.toContain('vitest')
  })

  it('leaves solutionCode empty when the section is missing, rather than using the stub', () => {
    const withoutSolution = challenge.slice(0, challenge.indexOf('## Solution'))
    const result = parseExercise(withoutSolution)
    expect(result.success).toBe(true)
    if (!result.success) return

    // Empty is honest: a stub masquerading as a solution is what hid the
    // problem in the first place.
    expect(result.exercise.solutionCode).toBe('')
    expect(result.exercise.starterCode).toContain('Your implementation here')
  })

  it('still treats a blank exercise as before', () => {
    const blank = `---
slug: demo-blank
title: Demo blank
description: A demo.
difficulty: beginner
type: blank
---

\`\`\`ts
const x = ___blank_start___42___blank_end___
\`\`\`
`
    const result = parseExercise(blank)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.exercise.solutionCode).toContain('42')
    expect(result.exercise.blanks.length).toBe(1)
  })
})

/**
 * A review exercise starts from code that already looks finished and is wrong.
 * The parser has to keep that code as the starter — it is the whole exercise —
 * and take the reference from `## Solution`, exactly as a challenge does.
 */
describe('review exercises', () => {
  const review = `---
slug: demo-review
title: 'Review: a demo'
description: Find the defect.
difficulty: intermediate
type: review
---

# Demo

\`\`\`ts
export function half(n: number): number {
  return n / 3
}
\`\`\`

## Tests

\`\`\`ts
import { expect, it } from 'vitest'
it('halves', () => expect(half(4)).toBe(2))
\`\`\`

## Solution

\`\`\`ts
export function half(n: number): number {
  return n / 2
}
\`\`\`
`

  it('keeps the defective code as the starter', () => {
    const result = parseExercise(review)
    expect(result.success).toBe(true)
    if (!result.success) return

    // The bug is the exercise. Replacing the starter with the answer would
    // leave nothing to find.
    expect(result.exercise.starterCode).toContain('n / 3')
    expect(result.exercise.solutionCode).toContain('n / 2')
  })

  it('extracts no blanks', () => {
    const result = parseExercise(review)
    if (!result.success) return
    expect(result.exercise.blanks).toEqual([])
  })

  it('reports the type it was given', () => {
    const result = parseExercise(review)
    if (!result.success) return
    expect(result.exercise.type).toBe('review')
  })
})

const AGENT = `---
slug: demo-agent
title: 'Supervise: a demo'
description: Catch the seeded failures.
difficulty: intermediate
type: agent
agentBudget: 2
interventionBudget: 3
---

Watch the agent work saveAll.

\`\`\`ts
export async function saveAll<T>(items: T[], save: (v: T) => Promise<T>): Promise<T[]> {
  const results: T[] = []
  items.forEach(async (item) => {
    results.push(await save(item))
  })
  return results
}
\`\`\`

## Tests

\`\`\`ts
import { expect, it } from 'vitest'
it('returns saved items', async () => {
  await expect(saveAll(['a'], async (v) => v)).resolves.toEqual(['a'])
})
\`\`\`

## Solution

\`\`\`ts
export async function saveAll<T>(items: T[], save: (v: T) => Promise<T>): Promise<T[]> {
  const results: T[] = []
  for (const item of items) {
    results.push(await save(item))
  }
  return results
}
\`\`\`

## Script

\`\`\`yaml
beats:
  - say: All tests pass now.
    run: false
seeds:
  - at: 0
    kind: hallucinated-pass
    window: 1
    weight: 3
    truth: no run backs the claim
    caught: []
    missed: []
rubric:
  - id: final-call
    weight: 3
\`\`\`
`

describe('agent exercises', () => {
  it('parses the script and keeps the starter as the first block', () => {
    const result = parseExercise(AGENT)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.exercise.type).toBe('agent')
    expect(result.exercise.frontmatter.agentBudget).toBe(2)
    expect(result.exercise.frontmatter.interventionBudget).toBe(3)
    expect(result.exercise.starterCode).toContain('forEach')
    expect(result.exercise.solutionCode).toContain('for (const item of items)')
    expect(result.exercise.agentScript?.beats).toHaveLength(1)
    expect(result.exercise.agentScript?.seeds[0]?.kind).toBe('hallucinated-pass')
  })

  it('refuses an agent exercise with no Script section', () => {
    const cut = AGENT.slice(0, AGENT.indexOf('## Script'))
    const result = parseExercise(cut)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]).toMatch(/Script/)
  })

  it('extractAgentScript returns null for other forms', () => {
    expect(extractAgentScript('# just a heading\n')).toBeNull()
  })
})
