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
import { executionService } from '../src/services/execution/index.js'

const TRACKS_DIR = join(import.meta.dir, '../../../content/tracks')

interface Fixture {
  track: string
  name: string
  type: string
  solution: string
  testCode: string
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
          testCode,
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
    const result = await executionService.execute(
      `verify-${fixture.track}-${fixture.name}`,
      'verify',
      fixture.solution,
      fixture.testCode,
      fixture.track
    )
    const seconds = ((Date.now() - started) / 1000).toFixed(1)

    if (result.status === 'passed' && (result.testResults?.length ?? 0) > 0) {
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
