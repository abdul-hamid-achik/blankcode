import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The MCP surface, pinned at the source level (the server needs Nitro's
 * runtime to instantiate). Two of these exist because a real harness session
 * demonstrated the failure: the full exercises payload measured ~74k tokens
 * and got fetched twice in one sitting, and an agent with no reflect step
 * uploads solutions without teaching anyone anything.
 */

const SOURCE = readFileSync(join(process.cwd(), 'server/utils/mcp-server.ts'), 'utf-8')
const SKILL = readFileSync(join(process.cwd(), 'public/skills/blankcode-practice.md'), 'utf-8')

describe('the MCP tool surface', () => {
  it('stays at ten tools, on purpose', () => {
    const registered = SOURCE.match(/registerTool\(\s*'([a-z_]+)'/g) ?? []
    expect(registered).toHaveLength(10)
    expect(SOURCE).toContain("'list_paths'")
    expect(SOURCE).toContain("'record_reflection'")
  })

  it('exposes the course prompt and the skill as MCP prompt/resource', () => {
    expect(SOURCE).toContain("registerPrompt(\n    'walk-a-path'")
    expect(SOURCE).toContain('registerResource(')
    expect(SOURCE).toContain('blankcode://skill/practice')
  })

  it('ledgers the meaningful actions for the live feed, fail-open', () => {
    for (const tool of ['get_exercise', 'run_tests', 'submit_solution', 'record_reflection']) {
      expect(SOURCE).toMatch(new RegExp(`record\\?\\.\\(\\{ tool: '${tool}'`))
    }
  })

  it('list_exercises projects the compact shape instead of proxying the full payload', () => {
    // The raw rows carry starterCode and full descriptions (~74k tokens for
    // the catalogue). The tool must map down to the promised fields.
    expect(SOURCE).not.toMatch(
      /registerTool\(\s*'list_exercises'[\s\S]{0,400}proxy\(ctx, '\/api\/exercises'\)/
    )
    for (const field of ['id', 'slug', 'title', 'difficulty', 'conceptId']) {
      expect(SOURCE).toContain(field)
    }
  })

  it('list_exercises accepts track and type filters', () => {
    expect(SOURCE).toMatch(/track:\s*z\s*\.string\(\)\s*\.optional\(\)/)
    expect(SOURCE).toMatch(/\.enum\(\['blank', 'challenge', 'review', 'turn', 'context'\]\)/)
  })

  it('list_paths renames challengeIds to exerciseIds for the agent', () => {
    expect(SOURCE).toContain('exerciseIds: challengeIds')
  })

  it('submit_solution appends reflect questions for every exercise form', () => {
    expect(SOURCE).toContain('reflectQuestions(')
    for (const form of ['review:', 'challenge:', 'blank:', 'turn:', 'context:']) {
      expect(SOURCE).toContain(form)
    }
    // Fail-open: the verdict survives even if the coaching garnish fails.
    expect(SOURCE).toMatch(/catch\s*{\s*return result/)
  })

  it('the instructions and the skill file teach the reflect etiquette', () => {
    expect(SOURCE).toContain('reflect')
    expect(SKILL).toContain('reflect')
    expect(SKILL).toContain('list_paths')
  })
})
