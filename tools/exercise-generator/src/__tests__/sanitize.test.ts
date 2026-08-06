import { describe, expect, it } from 'vitest'
import { sanitizeGeneratedMarkdown } from '../index.js'

describe('sanitizeGeneratedMarkdown', () => {
  const exercise = `---
slug: ts-generics-001
title: Generic Identity
---

Fill in the blank.

\`\`\`typescript
const x = ___blank_start___1___blank_end___
\`\`\``

  it('leaves clean output untouched', () => {
    expect(sanitizeGeneratedMarkdown(exercise)).toBe(exercise)
  })

  it('unwraps an outer ```markdown fence', () => {
    expect(sanitizeGeneratedMarkdown(`\`\`\`markdown\n${exercise}\n\`\`\``)).toBe(exercise)
  })

  it('unwraps a bare outer fence', () => {
    expect(sanitizeGeneratedMarkdown(`\`\`\`\n${exercise}\n\`\`\``)).toBe(exercise)
  })

  it('drops a chatty preamble before the frontmatter', () => {
    const withPreamble = `Sure! Here is the exercise you asked for:\n\n${exercise}`
    expect(sanitizeGeneratedMarkdown(withPreamble)).toBe(exercise)
  })

  it('keeps inner code fences intact', () => {
    expect(sanitizeGeneratedMarkdown(exercise)).toContain('```typescript')
  })

  it('does not mangle output that has no frontmatter', () => {
    expect(sanitizeGeneratedMarkdown('just some text')).toBe('just some text')
  })
})
