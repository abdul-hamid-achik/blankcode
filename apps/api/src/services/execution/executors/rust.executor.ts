import { config } from '../../../config/index.js'
import { logger } from '../logger.js'
import { parseCargoTestOutput } from '../parsers/vitest.parser.js'
import { cleanupWorkspace, executeInDocker, executeLocally, prepareWorkspace } from '../sandbox.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

/**
 * Crates vendored into the runner image. Keep this in sync with the
 * `[dependencies]` table in docker/runners/Dockerfile.rust — the sandbox runs
 * with `--network=none`, so a crate that is not in the image can never be
 * fetched at submission time.
 */
const VENDORED_CRATES: Record<string, string> = {
  tokio:
    'tokio = { version = "1", features = ["macros", "rt", "rt-multi-thread", "sync", "time"] }',
  // serde is the serialization crate in Rust; an exercise about building a
  // request or parsing a payload is artificial without it.
  serde: 'serde = { version = "1", features = ["derive"] }',
  serde_json: 'serde_json = "1"',
}

/** Module the submission's tests are compiled into, inside the solution crate. */
const TESTS_MODULE = '__blankcode_tests'

/** Paths baked into docker/runners/Dockerfile.rust. */
const VENDOR_DIR = '/opt/blankcode/vendor'
const PREBUILT_TARGET = '/opt/blankcode/prebuilt/target'

/**
 * Tests are compiled as a unit-test module *inside* the solution crate rather
 * than as an integration test under `tests/`. An integration test is a separate
 * crate that can only see `pub` items, and not one exercise in the corpus marks
 * anything `pub` — every Rust submission failed to compile because of it.
 *
 * The submission's own line numbers are preserved (nothing is prepended), so
 * compile errors point at the line the student actually typed.
 */
export function buildLibSource(code: string, testCode: string): string {
  // Legacy tests written against the old integration-test layout say
  // `use solution::*`. Inside the crate that path does not resolve.
  const tests = testCode.replace(/\bsolution::/g, 'crate::')

  const body = tests
    .split('\n')
    .map((line) => (line.trim() ? `    ${line}` : line))
    .join('\n')

  // Nesting is safe: test code that already declares its own
  // `#[cfg(test)] mod tests { use super::* }` still resolves, because a glob
  // import re-exposes the names its parent glob-imported.
  return `${code.trimEnd()}

#[cfg(test)]
mod ${TESTS_MODULE} {
    use super::*;

${body}
}
`
}

/** Which vendored crates this submission references. */
export function detectCrates(source: string): string[] {
  return Object.keys(VENDORED_CRATES)
    .filter((name) => new RegExp(`\\b(?:extern\\s+crate\\s+${name}\\b|${name}\\s*::)`).test(source))
    .toSorted()
}

/**
 * Must stay in sync with the manifest in docker/runners/Dockerfile.rust, or the
 * prebuilt dependency artifacts miss and cargo rebuilds them in the sandbox.
 *
 * `debug = 0` is load bearing: the sandbox sets `--ulimit=fsize=10485760`, and
 * a default debug build of tokio emits a 10.4 MB rlib that trips SIGXFSZ.
 */
export function buildCargoManifest(crates: readonly string[]): string {
  const dependencies = crates.map((name) => VENDORED_CRATES[name]).filter(Boolean)

  return `[package]
name = "solution"
version = "0.1.0"
edition = "2021"

[lib]
name = "solution"
path = "src/lib.rs"
doctest = false

[profile.dev]
debug = 0
incremental = false

[profile.test]
debug = 0
incremental = false

[lints.rust]
dead_code = "allow"
unused_imports = "allow"
unused_mut = "allow"
unused_parens = "allow"
unused_variables = "allow"

[dependencies]
${dependencies.join('\n')}
`
}

/** Points cargo at the offline directory source vendored into the image. */
function buildCargoConfig(): string {
  return `[source.crates-io]
replace-with = "blankcode-vendor"

[source.blankcode-vendor]
directory = "${VENDOR_DIR}"
`
}

/**
 * Runs inside the container. Constant — no submission data is interpolated.
 *
 * CARGO_HOME defaults into the read-only rootfs but cargo needs to write a lock
 * file there, and the image's prebuilt dependency artifacts have to be copied
 * into the writable workspace because cargo cannot write to a read-only target
 * dir. `cp -a` preserves mtimes, which cargo fingerprints depend on.
 */
const DOCKER_TEST_SCRIPT = [
  'set -e',
  'export CARGO_HOME=/app/.cargo-home',
  `if [ -f .cargo/config.toml ] && [ -d ${PREBUILT_TARGET} ] && [ ! -e target ]; then`,
  `  cp -a ${PREBUILT_TARGET} target || rm -rf target`,
  'fi',
  // Deliberately NOT --nocapture: it interleaves the submission's println!
  // output into the `test <name> ... ok` lines the parser reads, so a solution
  // that prints anything reports zero tests and is graded as an error.
  'exec cargo test --offline',
].join('\n')

export class RustExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()

    const crates = detectCrates(`${context.code}\n${context.testCode}`)
    const useDocker = config.execution.dockerEnabled

    logger.info('Executor started', {
      submissionId: context.submissionId,
      exerciseId: context.exerciseId,
      language: context.language,
      crates,
    })

    const files: Record<string, string> = {
      'src/lib.rs': buildLibSource(context.code, context.testCode),
      'Cargo.toml': buildCargoManifest(crates),
    }

    // Source replacement only exists inside the runner image. Locally (the
    // DOCKER_ENABLED=false developer path) cargo uses the machine's own
    // registry instead.
    if (useDocker && crates.length > 0) {
      files['.cargo/config.toml'] = buildCargoConfig()
    }

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (useDocker) {
        const result = await executeInDocker(context, files, ['sh', '-c', DOCKER_TEST_SCRIPT])
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        const workDir = await prepareWorkspace(files)
        try {
          const testResult = await executeLocally('cargo', ['test'], workDir, context.timeoutMs)
          stdout = testResult.stdout
          stderr = testResult.stderr
          exitCode = testResult.exitCode
        } finally {
          try {
            await cleanupWorkspace(workDir)
          } catch (cleanupError) {
            logger.warn('Failed to clean up workspace', { workDir, error: String(cleanupError) })
          }
        }
      }

      const executionTimeMs = Date.now() - startTime
      const output = `${stdout}\n${stderr}`

      if (exitCode === 124) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: 'Execution timeout exceeded',
        }
      }

      const testResults = parseCargoTestOutput(output)
      for (const result of testResults) {
        result.name = stripTestsModule(result.name)
      }

      if (testResults.length === 0 && exitCode !== 0) {
        const compilerError = extractRustError(output)
        const crateError = unavailableCrateError(output)

        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: crateError ? `${crateError}\n\n${compilerError}` : compilerError,
        }
      }

      // `[].every(...)` is true, so a run that produced no parseable results
      // would report "passed" with 0/0 tests — a false green that still marked
      // the exercise complete and advanced the SM-2 schedule. No tests is not a
      // pass; it means the suite never ran or its output could not be parsed.
      if (testResults.length === 0) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage:
            output.trim().slice(-2000) ||
            'The test suite produced no results. The code may not compile, or the tests did not run.',
        }
      }

      const allPassed = testResults.every((r) => r.passed)

      return {
        success: allPassed,
        status: allPassed ? 'passed' : 'failed',
        testResults,
        executionTimeMs,
      }
    } catch (error) {
      return {
        success: false,
        status: 'error',
        testResults: [],
        executionTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown execution error',
      }
    }
  }
}

function stripTestsModule(name: string): string {
  const prefix = `${TESTS_MODULE}::`
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

/**
 * rustc's own wording for "this identifier looks like a crate you never
 * declared". Kept broad because the phrasing has changed between releases.
 */
const MISSING_CRATE_PATTERNS = [
  /can't find crate for `([A-Za-z_][A-Za-z0-9_]*)`/g,
  /use of undeclared crate or module `([A-Za-z_][A-Za-z0-9_]*)`/g,
  /use of unresolved module or unlinked crate `([A-Za-z_][A-Za-z0-9_]*)`/g,
  /if you wanted to use a crate named `([A-Za-z_][A-Za-z0-9_]*)`/g,
  /maybe a missing crate `([A-Za-z_][A-Za-z0-9_]*)`/g,
]

const LOCAL_PATH_ROOTS = new Set(['alloc', 'core', 'crate', 'self', 'std', 'super'])

/**
 * rustc cannot tell a missing crate from a missing `use`, so it offers both
 * fixes. `mpsc::channel()` without `use std::sync::mpsc` produces the same
 * "unlinked crate" wording as a genuinely absent crate — but only the former
 * also gets a `use std::…` suggestion.
 */
function hasStdImportSuggestion(output: string, name: string): boolean {
  return new RegExp(`use\\s+(?:std|core|alloc)::[A-Za-z0-9_:]*\\b${name}\\b`).test(output)
}

/**
 * The sandbox has no network, so "add the dependency" is not something the
 * student can do. Say that plainly instead of leaving them with E0432.
 */
export function unavailableCrateError(output: string): string | null {
  const missing = new Set<string>()

  for (const pattern of MISSING_CRATE_PATTERNS) {
    for (const match of output.matchAll(pattern)) {
      const name = match[1]
      if (!name || LOCAL_PATH_ROOTS.has(name) || VENDORED_CRATES[name]) continue
      if (hasStdImportSuggestion(output, name)) continue
      missing.add(name)
    }
  }

  if (missing.size === 0) return null

  const names = [...missing].toSorted().map((name) => `\`${name}\``)
  const available = Object.keys(VENDORED_CRATES).toSorted()

  return `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} not available in the Rust sandbox. The runner has no network access, so cargo cannot download crates — only ${available.join(', ')} ${available.length === 1 ? 'is' : 'are'} vendored into the image. Rewrite this exercise against the standard library, or vendor the crate in docker/runners/Dockerfile.rust.`
}

function extractRustError(output: string): string {
  const errorPatterns = [
    /error\[E\d+\]: (.+)/i,
    /error: (.+)/i,
    /cannot find (.+)/i,
    /expected (.+), found (.+)/i,
  ]

  for (const pattern of errorPatterns) {
    const match = output.match(pattern)
    if (match) {
      return match[0]?.trim() ?? ''
    }
  }

  const lines = output.split('\n').filter((l) => l.trim() && l.includes('error'))
  return lines.slice(0, 5).join('\n') || 'Unknown error'
}

export const rustExecutor = new RustExecutor()
