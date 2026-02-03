import { config } from '../../../config/index.js'
import { executeInDocker, prepareWorkspace, cleanupWorkspace, executeLocally } from '../sandbox.js'
import { parseGoTestOutput } from '../parsers/vitest.parser.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

export class GoExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()

    const files = {
      'solution.go': context.code,
      'solution_test.go': context.testCode,
      'go.mod': `module solution

go 1.22
`,
    }

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (config.execution.dockerEnabled) {
        const result = await executeInDocker(context, files, ['go', 'test', '-v', './...'])
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        const workDir = await prepareWorkspace(files)
        try {
          const testResult = await executeLocally('go', ['test', '-v', './...'], workDir, context.timeoutMs)
          stdout = testResult.stdout
          stderr = testResult.stderr
          exitCode = testResult.exitCode
        } finally {
          await cleanupWorkspace(workDir)
        }
      }

      const executionTimeMs = Date.now() - startTime
      const output = stdout + '\n' + stderr

      if (exitCode === 124) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: 'Execution timeout exceeded',
        }
      }

      const testResults = parseGoTestOutput(output)

      if (testResults.length === 0 && exitCode !== 0) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: extractGoError(output),
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

function extractGoError(output: string): string {
  const errorPatterns = [
    /cannot find package (.+)/i,
    /undefined: (.+)/i,
    /syntax error: (.+)/i,
    /cannot use (.+)/i,
    /type (.+) has no field or method/i,
  ]

  for (const pattern of errorPatterns) {
    const match = output.match(pattern)
    if (match) {
      return match[0]!.trim()
    }
  }

  const lines = output.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
  return lines.slice(-5).join('\n') || 'Unknown error'
}

export const goExecutor = new GoExecutor()
