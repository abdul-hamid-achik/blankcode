import { describe, it, expect } from 'vitest'
import {
  parseExercise,
  extractBlanks,
  generateStarterCode,
  validateExercise,
  stripBlankMarkers,
  BLANK_START_MARKER,
  BLANK_END_MARKER,
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
    const starter = generateStarterCode(code, blanks)
    expect(starter).not.toContain(BLANK_START_MARKER)
    expect(starter).not.toContain(BLANK_END_MARKER)
    expect(starter).not.toContain('42')
    expect(starter).toContain('___')
  })

  it('preserves non-blank code', () => {
    const code = `const greeting = "hello";
const x = ${BLANK_START_MARKER}42${BLANK_END_MARKER};
console.log(x);`
    const blanks = extractBlanks(code)
    const starter = generateStarterCode(code, blanks)
    expect(starter).toContain('const greeting = "hello"')
    expect(starter).toContain('console.log(x)')
  })

  it('handles multiple blanks', () => {
    const code = `const a = ${BLANK_START_MARKER}1${BLANK_END_MARKER};
const b = ${BLANK_START_MARKER}2${BLANK_END_MARKER};`
    const blanks = extractBlanks(code)
    const starter = generateStarterCode(code, blanks)
    expect(starter).not.toContain('1')
    expect(starter).not.toContain('2')
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
      expect(errors).toContain('Exercise must have at least one blank region')
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
