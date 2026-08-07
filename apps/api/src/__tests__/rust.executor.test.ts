import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCargoManifest,
  buildLibSource,
  detectCrates,
  rustExecutor,
  unavailableCrateError,
} from '../services/execution/executors/rust.executor.js'
import { runnerImageAvailable } from './sandbox-available.js'

const DOCKERFILE = join(process.cwd(), '../../docker/runners/Dockerfile.rust')
const RUST_TRACK = join(process.cwd(), '../../content/tracks/rust')

describe('buildLibSource', () => {
  const solution = 'fn double(n: i32) -> i32 {\n    n * 2\n}'
  const tests = '#[test]\nfn doubles() {\n    assert_eq!(double(2), 4);\n}'

  it('compiles the tests into the solution crate, not a separate test crate', () => {
    const lib = buildLibSource(solution, tests)

    // The whole point: a `tests/` integration crate can only see `pub` items,
    // and no exercise in the corpus marks anything `pub`.
    expect(lib).toContain('#[cfg(test)]')
    expect(lib).toContain('mod __blankcode_tests')
    expect(lib).toContain('use super::*;')
    expect(lib).toContain('assert_eq!(double(2), 4);')
  })

  it('leaves the submission at the top so compile errors keep their line numbers', () => {
    const lib = buildLibSource(solution, tests)
    const lines = lib.split('\n')

    expect(lines[0]).toBe('fn double(n: i32) -> i32 {')
    expect(lines[1]).toBe('    n * 2')
    expect(lines.indexOf('#[cfg(test)]')).toBeGreaterThan(2)
  })

  it('rewrites legacy `use solution::*` imports to the enclosing crate', () => {
    const lib = buildLibSource(solution, 'use solution::*;\n\n#[test]\nfn t() {}')

    expect(lib).toContain('use crate::*;')
    expect(lib).not.toContain('use solution::')
  })

  it('keeps test code that already declares its own cfg(test) module', () => {
    const lib = buildLibSource(solution, '#[cfg(test)]\nmod tests {\n    use super::*;\n}')

    expect(lib).toContain('mod tests {')
    expect(lib).toContain('mod __blankcode_tests')
  })
})

describe('detectCrates', () => {
  it('finds tokio through an attribute macro with no `use` statement', () => {
    expect(detectCrates('#[tokio::main]\nasync fn main() {}')).toEqual(['tokio'])
  })

  it('finds tokio through a use statement', () => {
    expect(detectCrates('use tokio::time::{sleep, Duration};')).toEqual(['tokio'])
  })

  it('finds tokio through `extern crate`', () => {
    expect(detectCrates('extern crate tokio;')).toEqual(['tokio'])
  })

  it('adds nothing for a std-only submission', () => {
    expect(detectCrates('use std::collections::HashMap;\nfn main() {}')).toEqual([])
  })
})

describe('buildCargoManifest', () => {
  it('builds a lib crate with doctests off', () => {
    const manifest = buildCargoManifest([])

    expect(manifest).toContain('path = "src/lib.rs"')
    expect(manifest).toContain('doctest = false')
    expect(manifest).not.toContain('tokio')
  })

  it('strips debuginfo so artifacts stay under the sandbox fsize ulimit', () => {
    // sandbox.ts sets --ulimit=fsize=10485760; a default debug build of tokio
    // emits a 10.4 MB rlib and dies with SIGXFSZ.
    expect(buildCargoManifest(['tokio'])).toContain('debug = 0')
  })

  it('declares only crates the runner image has vendored', () => {
    const dockerfile = readFileSync(DOCKERFILE, 'utf-8')
    const dependency = buildCargoManifest(detectCrates('#[tokio::main]'))
      .split('\n')
      .find((line) => line.startsWith('tokio ='))

    expect(dependency).toBeDefined()
    // The sandbox runs --network=none. A dependency the image did not vendor
    // can never be fetched, so the two lists have to be identical.
    expect(dockerfile).toContain(dependency)
  })
})

describe('unavailableCrateError', () => {
  it('explains that the sandbox is offline instead of leaving the student on E0432', () => {
    const message = unavailableCrateError(
      'error[E0432]: unresolved import `reqwest`\n  |     ^^^^^ use of unresolved module or unlinked crate `reqwest`\n  = help: if you wanted to use a crate named `reqwest`, use `cargo add reqwest`'
    )

    expect(message).toContain('`reqwest`')
    expect(message).toContain('no network access')
    expect(message).toContain('tokio')
  })

  it('stays quiet for a crate the image does vendor', () => {
    expect(
      unavailableCrateError('error[E0433]: use of undeclared crate or module `tokio`')
    ).toBeNull()
  })

  it('stays quiet for an ordinary compile error', () => {
    expect(
      unavailableCrateError('error[E0308]: mismatched types\n  expected `i32`, found `&str`')
    ).toBeNull()
  })

  it('stays quiet for a std module that only needs importing', () => {
    // rustc reports a missing `use std::sync::mpsc` with the same "unlinked
    // crate" wording as a genuinely absent crate, and also offers the import.
    expect(
      unavailableCrateError(
        'error[E0433]: failed to resolve: use of unresolved module or unlinked crate `mpsc`\n' +
          '  = help: if you wanted to use a crate named `mpsc`, use `cargo add mpsc`\n' +
          'help: consider importing this module\n  |\n5 +     use std::sync::mpsc;\n'
      )
    ).toBeNull()
  })
})

describe('cargo invocation', () => {
  it('never passes --nocapture', () => {
    // `--nocapture` interleaves the submission's println! output into the
    // `test <name> ... ok` lines parseCargoTestOutput reads, so every printing
    // solution reports zero tests and is graded as an error. Source-level
    // because the flag is only observable by shelling out to Docker.
    const source = readFileSync(
      join(process.cwd(), 'src/services/execution/executors/rust.executor.ts'),
      'utf-8'
    )
    const code = source.replace(/\/\/.*$/gm, '')

    expect(code).not.toContain('--nocapture')
  })
})

/**
 * End-to-end proof that the corpus actually runs. Needs Docker plus
 * `blankcode/runner-rust:latest`, so it runs only when that image exists —
 * build it with `bun run runners:build`. Set REQUIRE_SANDBOX_TESTS=1 to make a
 * missing image a hard failure instead of a skip (use this in CI).
 */
interface Fixture {
  name: string
  code: string
  testCode: string
}

/**
 * Only blank exercises. A challenge's first fenced block is a skeleton (or,
 * today, an "Example Usage" snippet), so there is no canonical solution to run
 * against its tests — that is a content problem, not an executor one.
 */
function loadRustExercises(): Fixture[] {
  const fixtures: Fixture[] = []

  for (const concept of readdirSync(RUST_TRACK, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()) {
    for (const file of readdirSync(join(RUST_TRACK, concept))
      .filter((name) => name.endsWith('.md'))
      .toSorted()) {
      const markdown = readFileSync(join(RUST_TRACK, concept, file), 'utf-8')
      const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '')
      const solution = body.match(/```[\w]*\n([\s\S]*?)```/)?.[1]?.trim()
      const testCode = markdown.match(/## Tests\s*```[\w]*\n([\s\S]*?)```/)?.[1]?.trim()
      if (!solution?.includes('___blank_start___') || !testCode) continue

      fixtures.push({
        name: `${concept}/${file}`,
        code: solution.replaceAll('___blank_start___', '').replaceAll('___blank_end___', ''),
        testCode,
      })
    }
  }

  return fixtures
}

// Auto-detected rather than opt-in: these run for anyone who has built the
// runner images, and skip with a reason for anyone who has not.
const RUST_IMAGE = 'blankcode/runner-rust:latest'
const SANDBOX_DISABLED = !runnerImageAvailable(RUST_IMAGE)

const run = (code: string, testCode: string) =>
  rustExecutor.execute({
    submissionId: 'harness',
    exerciseId: 'harness',
    code,
    testCode,
    language: 'rust',
    timeoutMs: 120_000,
    memoryLimitMb: 256,
  })

describe.skipIf(SANDBOX_DISABLED)('rust sandbox behaviour', () => {
  it('sees private items, with nothing in the submission marked pub', async () => {
    // The old layout put tests in tests/solution_test.rs — a separate crate
    // that can only reach `pub` items. No exercise in the corpus has any.
    const result = await run(
      'struct Counter { n: i32 }\n\nfn bump(c: &mut Counter) {\n    c.n += 1;\n}',
      '#[test]\nfn bumps() {\n    let mut c = Counter { n: 1 };\n    bump(&mut c);\n    assert_eq!(c.n, 2);\n}'
    )

    expect(result.status).toBe('passed')
    expect(result.testResults).toHaveLength(1)
  }, 180_000)

  it('grades a printing solution, rather than losing its result lines', async () => {
    const result = await run(
      'fn shout(s: &str) -> String {\n    println!("shouting {}", s);\n    s.to_uppercase()\n}',
      '#[test]\nfn shouts() {\n    assert_eq!(shout("hi"), "HI");\n}'
    )

    expect(result.status).toBe('passed')
    expect(result.testResults.map((test) => test.name)).toEqual(['shouts'])
  }, 180_000)

  it('fails a wrong answer instead of reporting a false pass', async () => {
    const result = await run(
      'fn double(n: i32) -> i32 {\n    n + 2\n}',
      '#[test]\nfn doubles() {\n    assert_eq!(double(3), 6);\n}'
    )

    expect(result.status).toBe('failed')
    expect(result.success).toBe(false)
    expect(result.testResults).toEqual([
      { name: 'doubles', passed: false, message: null, duration: 0 },
    ])
  }, 180_000)

  it('explains an unavailable crate instead of leaving a bare E0432', async () => {
    const result = await run(
      'use reqwest::Client;\n\nfn noop() {}',
      '#[test]\nfn t() {\n    noop();\n}'
    )

    expect(result.status).toBe('error')
    expect(result.errorMessage).toContain('`reqwest`')
    expect(result.errorMessage).toContain('no network access')
  }, 180_000)
})

describe.skipIf(SANDBOX_DISABLED)('rust corpus in the sandbox', () => {
  it.each(loadRustExercises())(
    '$name canonical solution passes its own tests',
    async (fixture) => {
      const result = await run(fixture.code, fixture.testCode)

      expect(result.errorMessage ?? '').toBe('')
      expect(result.testResults.length).toBeGreaterThan(0)
      expect(result.testResults.filter((test) => !test.passed)).toEqual([])
      expect(result.status).toBe('passed')
    },
    180_000
  )
})
