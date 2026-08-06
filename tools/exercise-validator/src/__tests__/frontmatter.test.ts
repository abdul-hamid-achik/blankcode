import { describe, expect, it } from 'vitest'
import { diagnoseFrontmatter } from '../frontmatter.js'

const VALID = [
  'slug: go-basics-adder',
  'title: Adder',
  'description: Add two numbers.',
  'difficulty: beginner',
  'hints:',
  '  - Use the + operator',
  'tags:',
  '  - basics',
].join('\n')

describe('diagnoseFrontmatter', () => {
  it('is silent on valid frontmatter', () => {
    expect(diagnoseFrontmatter(VALID)).toEqual([])
  })

  it('pinpoints a hint whose unquoted colon turned it into a mapping', () => {
    const raw = [
      'slug: rust-demo',
      'title: Demo',
      'description: Demo.',
      'difficulty: beginner',
      'hints:',
      '  - The next state follows the cycle: Green -> Yellow -> Red',
    ].join('\n')

    const [diagnostic, ...rest] = diagnoseFrontmatter(raw)
    expect(rest).toEqual([])
    expect(diagnostic?.message).toContain('parsed as a YAML mapping')
    expect(diagnostic?.message).toContain('must be quoted')
    // Offset must land on the sixth line, not at the top of the block.
    expect(raw.slice(diagnostic?.offset ?? 0).startsWith('The next state')).toBe(true)
  })

  it('accepts the same hint once it is quoted', () => {
    const raw = [
      'slug: rust-demo',
      'title: Demo',
      'description: Demo.',
      'difficulty: beginner',
      'hints:',
      "  - 'The next state follows the cycle: Green -> Yellow -> Red'",
    ].join('\n')
    expect(diagnoseFrontmatter(raw)).toEqual([])
  })

  it('reports missing required keys', () => {
    const messages = diagnoseFrontmatter('title: Only a title').map((d) => d.message)
    expect(messages).toContain('Required key `slug` is missing.')
    expect(messages).toContain('Required key `description` is missing.')
    expect(messages).toContain('Required key `difficulty` is missing.')
  })

  it('rejects a slug that breaks the schema pattern', () => {
    const raw = VALID.replace('go-basics-adder', 'Go Basics Adder')
    const messages = diagnoseFrontmatter(raw).map((d) => d.message)
    expect(messages.join(' ')).toContain('/^[a-z0-9-]+$/')
  })

  it('rejects an unknown difficulty and an unknown type', () => {
    const raw = `${VALID.replace('difficulty: beginner', 'difficulty: trivial')}\ntype: puzzle`
    const messages = diagnoseFrontmatter(raw).map((d) => d.message)
    expect(messages.join(' ')).toContain('`difficulty` must be one of')
    expect(messages.join(' ')).toContain('`type` must be one of')
  })

  it('rejects hints that are not a list', () => {
    const raw = VALID.replace('hints:\n  - Use the + operator', 'hints: not-a-list')
    const messages = diagnoseFrontmatter(raw).map((d) => d.message)
    expect(messages).toContain('`hints` must be a list of strings.')
  })
})
