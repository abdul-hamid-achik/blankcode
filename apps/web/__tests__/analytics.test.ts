import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * These guard what analytics collects, not that it works.
 *
 * The privacy policy tells people what leaves the site. A `userId` added to an
 * event turns an aggregate counter into behavioural tracking of a named person
 * — a different thing, with different obligations, that nobody was told about.
 * A test is a cheaper place to catch that than a policy review.
 */

const composable = readFileSync(join(process.cwd(), 'composables/useAnalytics.ts'), 'utf-8')

/**
 * Comments stripped before matching.
 *
 * The first version of this test failed on its own module's doc comment, which
 * uses the word "email" to explain why no event may carry one. A guard that
 * cannot tell prose from code produces exactly that kind of false alarm, and a
 * test people learn to ignore is worse than no test.
 */
const code = composable.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('custom events', () => {
  it('carry nothing that identifies a person', () => {
    for (const forbidden of ['userId', 'user_id', 'email', 'submissionId', 'sessionId']) {
      expect(code).not.toContain(forbidden)
    }
  })

  it('are a closed set rather than a free-form call', () => {
    // The point is that adding an event means editing this list, where someone
    // reviewing a diff can see it.
    expect(code).toContain('interface Events')
  })

  it('never let a metric break a page', () => {
    expect(code).toContain('catch')
  })

  it('do nothing during the server render', () => {
    // `track` is a browser call; running it in the Nitro handler would throw on
    // every request for a page nobody is looking at yet.
    expect(code).toContain('import.meta.server')
  })
})
