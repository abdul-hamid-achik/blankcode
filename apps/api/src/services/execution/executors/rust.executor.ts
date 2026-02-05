import { config } from '../../../config/index.js'
import { parseCargoTestOutput } from '../parsers/vitest.parser.js'
import { cleanupWorkspace, executeInDocker, executeLocally, prepareWorkspace } from '../sandbox.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

export class RustExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()

    // Auto-import from crate if test doesn't already use it
    let testCode = context.testCode
    if (!testCode.includes('use solution::')) {
      testCode = `use solution::*;\n\n${testCode}`
    }

    const usesTokio = /tokio::/m.test(context.code) || /tokio::/m.test(testCode)
    const dependencyBlock = usesTokio
      ? '\n[dependencies]\ntokio = { version = "1.39.0", features = ["macros", "rt-multi-thread", "time"] }\n'
      : '\n'

    const files = {
      'src/lib.rs': context.code,
      'tests/solution_test.rs': testCode,
      'Cargo.toml': `[package]
name = "solution"
version = "0.1.0"
edition = "2021"

[[test]]
name = "solution_test"
path = "tests/solution_test.rs"
${dependencyBlock}`,
    }

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (config.execution.dockerEnabled) {
        const result = await executeInDocker(context, files, ['cargo', 'test', '--', '--nocapture'])
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        const workDir = await prepareWorkspace(files)
        try {
          const testResult = await executeLocally(
            'cargo',
            ['test', '--', '--nocapture'],
            workDir,
            context.timeoutMs
          )
          stdout = testResult.stdout
          stderr = testResult.stderr
          exitCode = testResult.exitCode
        } finally {
          await cleanupWorkspace(workDir)
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

      if (testResults.length === 0 && exitCode !== 0) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: extractRustError(output),
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
