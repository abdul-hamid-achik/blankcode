import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractTaskBrief, parseExercise } from '@blankcode/exercise-parser'
import { AUTHORED_BRIEFS } from '../utils/authored-briefs'
import { presentTaskBrief } from '../utils/task-brief'

/**
 * Review and challenge work surfaces used to show the one-line description
 * and an editor. The brief transform is what the exercise page actually
 * renders, so these tests drive that function with the authored markdown
 * (or the brief derived from it) — not a reimplementation of the parser.
 */

const tracks = join(process.cwd(), '../../content/tracks')

function readExercise(rel: string): string {
  return readFileSync(join(tracks, rel), 'utf-8')
}

const reviewMd = readExercise('typescript/code-review/ts-review-001.md')
const challengeMd = readExercise('typescript/challenges/ts-challenge-001.md')

describe('presentTaskBrief', () => {
  it('a review brief states what to find and fix, and hides Solution / Tests', () => {
    const brief = presentTaskBrief({
      type: 'review',
      description: 'The pagination helper below was generated and shipped. It loses records.',
      markdown: reviewMd,
    })

    expect(brief.framing).toMatch(/defect/i)
    expect(brief.body).toMatch(/silently returns fewer records/i)
    expect(brief.body).toMatch(/Find the defect and fix it/i)
    expect(brief.body).not.toMatch(/## Solution/)
    expect(brief.body).not.toMatch(/does not drop the final partial page/)
    expect(brief.body).not.toContain('Math.ceil')
  })

  it('a challenge brief states what to implement, and hides Solution / Tests', () => {
    const brief = presentTaskBrief({
      type: 'challenge',
      description: 'Implement a counter class with proper TypeScript types from scratch.',
      markdown: challengeMd,
    })

    expect(brief.framing).toMatch(/stub|implement/i)
    expect(brief.body).toMatch(/Private count property/i)
    expect(brief.body).toMatch(/prevent negative counts/i)
    expect(brief.body).not.toMatch(/## Solution/)
    expect(brief.body).not.toMatch(/should throw error when decrement/)
    expect(brief.body).not.toContain('#count')
  })

  it('falls back to the stored description when no markdown is on hand', () => {
    const brief = presentTaskBrief({
      type: 'review',
      description: 'The helper loses records. Find out which ones and why.',
    })

    expect(brief.body).toBe('The helper loses records. Find out which ones and why.')
    expect(brief.framing).toMatch(/defect/i)
  })

  it('uses a stored authored brief the same way the work surface does', () => {
    const brief = presentTaskBrief({
      type: 'review',
      description: 'one-liner',
      authoredBrief: AUTHORED_BRIEFS['ts-review-001'],
    })
    expect(brief.body).toBe(extractTaskBrief(reviewMd))
    expect(brief.body).toMatch(/Find the defect and fix it/i)
  })

  it('blank exercises keep the fill-in-the-blank contract — no extra framing', () => {
    const brief = presentTaskBrief({
      type: 'blank',
      description: 'Fill in the missing type parameter.',
      markdown:
        'Some extra prose.\n\n```ts\nconst x = 1\n```\n\n## Solution\n\n```ts\nconst x = 1\n```',
    })

    expect(brief.framing).toBeNull()
    expect(brief.body).toBe('Fill in the missing type parameter.')
  })

  it('AUTHORED_BRIEFS stays in lockstep with extractTaskBrief on every review and challenge', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (name.endsWith('.md')) files.push(full)
      }
    }
    walk(tracks)

    const expected: Record<string, string> = {}
    for (const file of files) {
      const markdown = readFileSync(file, 'utf-8')
      const parsed = parseExercise(markdown)
      if (!parsed.success) continue
      if (parsed.exercise.type !== 'review' && parsed.exercise.type !== 'challenge') continue
      expected[parsed.exercise.frontmatter.slug] = extractTaskBrief(markdown)
    }

    expect(AUTHORED_BRIEFS).toEqual(expected)
  })
})
