#!/usr/bin/env bun
/**
 * Runs every exercise's reference solution against its own tests.
 *
 * This is the guarantee the corpus rests on: an exercise nobody can solve is
 * worse than no exercise, because the learner assumes the failure is theirs.
 * Blank exercises had this check (per-track, inside the executor tests);
 * challenges never did, because until `## Solution` existed their "solution"
 * was the empty stub the learner starts from.
 *
 *   bun run content:verify              # every track
 *   bun run content:verify -- rust go   # only these
 *   bun run content:verify -- --challenges-only
 *
 * Needs a working execution backend: EXECUTION_BACKEND=vercel-sandbox with the
 * snapshot ids, or Docker with the runner images built.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseExercise } from '@blankcode/exercise-parser'
import type { AgentScript } from '@blankcode/shared/types'
import {
  collectAgentCodeStates,
  expectationHolds,
  solutionConflicts,
} from '../src/services/content-verify/agent-states.js'
import { executionService } from '../src/services/execution/index.js'

const TRACKS_DIR = join(import.meta.dir, '../../../content/tracks')

interface Fixture {
  track: string
  name: string
  type: string
  solution: string
  /** What the learner opens. Only carried for reviews, where it must fail. */
  starter: string
  testCode: string
  agentScript: AgentScript | null
}

function collect(tracks: string[], challengesOnly: boolean): Fixture[] {
  const fixtures: Fixture[] = []

  for (const track of tracks) {
    const trackDir = join(TRACKS_DIR, track)
    if (!statSync(trackDir, { throwIfNoEntry: false })?.isDirectory()) continue

    for (const concept of readdirSync(trackDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .toSorted()) {
      for (const file of readdirSync(join(trackDir, concept))
        .filter((n) => n.endsWith('.md'))
        .toSorted()) {
        const markdown = readFileSync(join(trackDir, concept, file), 'utf-8')
        const parsed = parseExercise(markdown, { validateFrontmatter: false })
        if (!parsed.success) continue

        const { solutionCode, type } = parsed.exercise
        if (challengesOnly && type !== 'challenge') continue

        const testCode = /## Tests\s*```[\w]*\n([\s\S]*?)```/.exec(markdown)?.[1]?.trim()
        if (!testCode) continue

        // A challenge with no `## Solution` yields an empty solution. Reported
        // rather than skipped: silence is how this went unnoticed for so long.
        fixtures.push({
          track,
          name: `${concept}/${file}`,
          type,
          solution: solutionCode
            .replaceAll('___blank_start___', '')
            .replaceAll('___blank_end___', ''),
          starter: parsed.exercise.starterCode,
          testCode,
          agentScript: parsed.exercise.agentScript,
        })
      }
    }
  }

  return fixtures
}

const args = process.argv.slice(2)
const challengesOnly = args.includes('--challenges-only')
const requested = args.filter((a) => !a.startsWith('--'))
const allTracks = readdirSync(TRACKS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .toSorted()
const tracks = requested.length > 0 ? requested : allTracks

const fixtures = collect(tracks, challengesOnly)
console.log(`Verifying ${fixtures.length} exercises across ${tracks.length} track(s)\n`)

let passed = 0
const failures: Array<{ fixture: Fixture; reason: string }> = []

for (const fixture of fixtures) {
  const label = `${fixture.track.padEnd(11)} ${fixture.name}`

  if (!fixture.solution) {
    failures.push({ fixture, reason: 'no reference solution (missing `## Solution`)' })
    console.log(`✗ ${label}  NO SOLUTION`)
    continue
  }

  const started = Date.now()
  try {
    /*
     * One retry, because the sandbox is occasionally flaky and this script is
     * meant to be a gate. A reference solution either passes deterministically
     * or it does not: a genuinely broken exercise fails both times, while a
     * transient sandbox failure would otherwise turn CI red for no reason and
     * teach everyone to rerun it without looking.
     */
    let result = await executionService.execute(
      `verify-${fixture.track}-${fixture.name}`,
      'verify',
      fixture.solution,
      fixture.testCode,
      fixture.track
    )
    if (result.status !== 'passed') {
      result = await executionService.execute(
        `verify-retry-${fixture.track}-${fixture.name}`,
        'verify',
        fixture.solution,
        fixture.testCode,
        fixture.track
      )
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1)

    if (result.status === 'passed' && (result.testResults?.length ?? 0) > 0) {
      /*
       * A review exercise makes one more promise than the others: the code the
       * learner opens is wrong. If the starter already passes there is nothing
       * to find, and the exercise is a lie that no other check can catch — it
       * parses, renders and grades perfectly.
       */
      if (fixture.type === 'review') {
        const starterRun = await executionService.execute(
          `verify-starter-${fixture.track}-${fixture.name}`,
          'verify',
          fixture.starter,
          fixture.testCode,
          fixture.track
        )
        if (starterRun.status === 'passed') {
          failures.push({
            fixture,
            reason: 'the starter passes its own tests, so there is no defect to find',
          })
          console.log(`✗ ${label}  STARTER PASSES  ${seconds}s`)
          continue
        }
      }

      if (fixture.type === 'agent') {
        if (!fixture.agentScript) {
          failures.push({ fixture, reason: 'agent exercise has no parsed script' })
          console.log(`✗ ${label}  NO SCRIPT`)
          continue
        }
        const collected = collectAgentCodeStates(fixture.agentScript, fixture.starter)
        if (!collected.ok) {
          failures.push({ fixture, reason: collected.reason })
          console.log(`✗ ${label}  SCRIPT  ${collected.reason}`)
          continue
        }
        const clash = solutionConflicts(collected.states, fixture.solution)
        if (clash) {
          failures.push({ fixture, reason: clash })
          console.log(`✗ ${label}  SEED LIES  ${clash}`)
          continue
        }
        let statesOk = true
        for (const state of collected.states) {
          if (state.code === fixture.solution) continue
          let stateRun = await executionService.execute(
            `verify-agent-${fixture.track}-${fixture.name}-${state.label}`,
            'verify',
            state.code,
            fixture.testCode,
            fixture.track
          )
          if (!expectationHolds(state.expect, stateRun)) {
            stateRun = await executionService.execute(
              `verify-agent-retry-${fixture.track}-${fixture.name}-${state.label}`,
              'verify',
              state.code,
              fixture.testCode,
              fixture.track
            )
          }
          if (!expectationHolds(state.expect, stateRun)) {
            failures.push({
              fixture,
              reason: `${state.label} should ${state.expect} but the suite said ${stateRun.status}`,
            })
            console.log(`✗ ${label}  ${state.label}  ${stateRun.status}`)
            statesOk = false
            break
          }
        }
        if (!statesOk) continue
      }

      passed++
      console.log(`✓ ${label}  ${result.testResults?.length} tests  ${seconds}s`)
    } else {
      const failed = (result.testResults ?? []).filter((t) => !t.passed)
      const reason =
        result.errorMessage ||
        (failed.length > 0
          ? `${failed.length} failing: ${failed.map((t) => t.name).join(', ')}`
          : 'no tests ran')
      failures.push({ fixture, reason })
      console.log(`✗ ${label}  ${result.status}  ${seconds}s`)
      console.log(`    ${reason.split('\n')[0]?.slice(0, 160)}`)
    }
  } catch (error) {
    failures.push({ fixture, reason: String(error) })
    console.log(`✗ ${label}  threw`)
    console.log(`    ${String(error).slice(0, 160)}`)
  }
}

console.log(`\n${passed}/${fixtures.length} reference solutions pass their own tests`)

if (failures.length > 0) {
  console.log(`\n${failures.length} need attention:`)
  for (const { fixture, reason } of failures) {
    console.log(`  ${fixture.track}/${fixture.name}: ${reason.split('\n')[0]?.slice(0, 120)}`)
  }
  process.exit(1)
}
