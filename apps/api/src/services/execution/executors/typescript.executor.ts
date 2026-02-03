import { config } from '../../../config/index.js'
import { executeInDocker, executeLocally, prepareWorkspace, cleanupWorkspace } from '../sandbox.js'
import { parseVitestOutput } from '../parsers/vitest.parser.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

export class TypeScriptExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()

    const files = {
      'solution.ts': context.code,
      'solution.test.ts': context.testCode,
      'package.json': JSON.stringify({
        name: 'test-runner',
        type: 'module',
        scripts: {
          test: 'vitest run --reporter=json',
        },
        devDependencies: {
          vitest: '^2.0.0',
          typescript: '^5.0.0',
        },
      }),
      'vitest.config.ts': `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    globals: true,
    reporters: ['json'],
    outputFile: './results.json',
  },
})
`,
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      }),
    }

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (config.execution.dockerEnabled) {
        const result = await executeInDocker(context, files, ['npm', 'test'])
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        const workDir = await prepareWorkspace(files)
        try {
          // Install dependencies
          const installResult = await executeLocally('npm', ['install', '--silent'], workDir, 60000)
          if (installResult.exitCode !== 0) {
            return {
              success: false,
              status: 'error',
              testResults: [],
              executionTimeMs: Date.now() - startTime,
              errorMessage: `Failed to install dependencies: ${installResult.stderr}`,
            }
          }

          // Run tests
          const testResult = await executeLocally('npm', ['test'], workDir, context.timeoutMs)
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

      const testResults = parseVitestOutput(output)

      if (testResults.length === 0 && exitCode !== 0) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: extractErrorMessage(output),
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

function extractErrorMessage(output: string): string {
  const errorPatterns = [
    /error TS\d+: (.+)/i,
    /SyntaxError: (.+)/i,
    /TypeError: (.+)/i,
    /ReferenceError: (.+)/i,
    /Error: (.+)/i,
  ]

  for (const pattern of errorPatterns) {
    const match = output.match(pattern)
    if (match) {
      return match[1]!.trim()
    }
  }

  const lines = output.split('\n').filter((l) => l.trim())
  return lines.slice(-5).join('\n') || 'Unknown error'
}

export const typescriptExecutor = new TypeScriptExecutor()
