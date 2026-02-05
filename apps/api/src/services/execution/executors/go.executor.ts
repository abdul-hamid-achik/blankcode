import { config } from '../../../config/index.js'
import { logger } from '../logger.js'
import { parseGoTestOutput } from '../parsers/vitest.parser.js'
import { cleanupWorkspace, executeInDocker, executeLocally, prepareWorkspace } from '../sandbox.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

function isProgramMode(code: string): boolean {
  return /package\s+main\b/.test(code)
}

export class GoExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()

    const isProgram = isProgramMode(context.code)
    logger.info('Executor started', {
      submissionId: context.submissionId,
      exerciseId: context.exerciseId,
      language: context.language,
      isProgram,
    })

    if (context.testCode?.trim()) {
      return this.executeAsTests(context, startTime)
    }

    if (isProgram) {
      return this.executeAsProgram(context, startTime)
    } else {
      return this.executeAsTests(context, startTime)
    }
  }

  private async executeAsProgram(
    context: ExecutionContext,
    startTime: number
  ): Promise<ExecutionResult> {
    let solutionCode = context.code

    const hasPackageMain = /package\s+main\b/.test(solutionCode)
    const hasFuncMain = /\bfunc\s+main\s*\(\s*\)/.test(solutionCode)

    if (!hasPackageMain) {
      solutionCode = `package main\n\n${solutionCode}`
    }

    if (!hasFuncMain) {
      const mainFunc = `\n\nfunc main() {\n}\n`
      solutionCode = solutionCode + mainFunc
    }

    const files = {
      'main.go': solutionCode,
      'go.mod': `module main

go 1.22
`,
    }

    logger.debug('Running as PROGRAM mode', { submissionId: context.submissionId, isProgram: true })

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (config.execution.dockerEnabled) {
        logger.debug('Starting Docker run', {
          submissionId: context.submissionId,
          image: config.execution.images['go'],
        })
        const startExec = Date.now()
        const result = await executeInDocker(context, files, ['go', 'run', 'main.go'])
        const execDuration = Date.now() - startExec
        logger.debug('Docker execution complete', {
          submissionId: context.submissionId,
          exitCode: result.exitCode,
          stdoutLen: result.stdout.length,
          stderrLen: result.stderr.length,
          execDurationMs: execDuration,
          stdout: result.stdout.substring(0, 500),
          stderr: result.stderr.substring(0, 500),
        })
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        const workDir = await prepareWorkspace(files)
        try {
          const runResult = await executeLocally(
            'go',
            ['run', 'main.go'],
            workDir,
            context.timeoutMs
          )
          stdout = runResult.stdout
          stderr = runResult.stderr
          exitCode = runResult.exitCode
        } finally {
          await cleanupWorkspace(workDir)
        }
      }

      const executionTimeMs = Date.now() - startTime
      logger.info('Execution complete', {
        submissionId: context.submissionId,
        exitCode,
        executionTimeMs,
        success: exitCode === 0,
      })

      if (exitCode === 124) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: 'Execution timeout exceeded',
        }
      }

      if (exitCode !== 0) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: extractGoError(stderr),
        }
      }

      return {
        success: true,
        status: 'passed',
        testResults: [
          {
            name: 'Program executed',
            passed: true,
            message: stdout.trim(),
            duration: executionTimeMs,
          },
        ],
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

  private async executeAsTests(
    context: ExecutionContext,
    startTime: number
  ): Promise<ExecutionResult> {
    let solutionCode = context.code
    if (!solutionCode.includes('package ')) {
      solutionCode = `package solution\n\n${solutionCode}`
    }

    let testCode = context.testCode
    if (!testCode.includes('package ')) {
      testCode = `package solution\n\n${testCode}`
    }

    const files = {
      'solution.go': solutionCode,
      'solution_test.go': testCode,
      'go.mod': `module solution

go 1.22
`,
    }

    logger.debug('Running as TEST mode', { submissionId: context.submissionId })

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (config.execution.dockerEnabled) {
        const result = await executeInDocker(context, files, ['go', 'test', '-v', './...'])
        logger.debug('Docker test execution complete', {
          submissionId: context.submissionId,
          exitCode: result.exitCode,
          stdoutLen: result.stdout.length,
          stderrLen: result.stderr.length,
        })
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        const workDir = await prepareWorkspace(files)
        try {
          const testResult = await executeLocally(
            'go',
            ['test', '-v', './...'],
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

      const testResults = parseGoTestOutput(output)

      logger.info('Test execution complete', {
        submissionId: context.submissionId,
        exitCode,
        testCount: testResults.length,
        passedCount: testResults.filter((t) => t.passed).length,
        executionTimeMs,
      })

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
      return match[0]?.trim() ?? ''
    }
  }

  const lines = output.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
  return lines.slice(-5).join('\n') || 'Unknown error'
}

export const goExecutor = new GoExecutor()
