import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The agent-session routes, asserted at the source: a GET that serialised
 * `script` would hand the learner every seed's truth, which is the whole
 * exercise. Same class of leak as context `required` and hidden tests.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf-8')

const START = 'server/routes/api/agent-sessions/index.post.ts'
const GET = 'server/routes/api/agent-sessions/[id]/index.get.ts'
const DECIDE = 'server/routes/api/agent-sessions/[id]/decide.post.ts'
const CLOSE = 'server/routes/api/agent-sessions/[id]/close.post.ts'
const SERVICE = 'server/utils/agent-session-service.ts'

describe('agent session routes', () => {
  it('start refuses anything that is not type agent', () => {
    expect(read(START)).toContain("exercise.type !== 'agent'")
  })

  it('start runs the opening beat through the hidden runner', () => {
    expect(read(START)).toContain('makeHiddenRunner')
  })

  it('decide does not accept the terminal actions', () => {
    const decide = read(DECIDE)
    expect(decide).not.toContain('accept-work')
    expect(decide).not.toContain('reject-work')
  })

  it('close is the only path that accepts the final call', () => {
    expect(read(CLOSE)).toContain('accept-work')
    expect(read(CLOSE)).toContain('reject-work')
  })

  it('the public view never copies the script onto the payload', () => {
    const source = read(SERVICE)
    const start = source.indexOf('export function publicView')
    const end = source.indexOf('export async function startAgentSession')
    const view = source.slice(start, end)
    expect(view).toContain('return {')
    expect(view).not.toMatch(/^\s*script:/m)
    expect(view).toContain('beat:')
  })

  it('GET goes through publicView, not the stored row', () => {
    expect(read(GET)).toContain('loadOwnSession')
  })
})
