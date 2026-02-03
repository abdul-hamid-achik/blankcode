import { config } from '../../../config/index.js'
import { parseVitestOutput } from '../parsers/vitest.parser.js'
import { cleanupWorkspace, executeInDocker, executeLocally, prepareWorkspace } from '../sandbox.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

export class TypeScriptExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()

    // Auto-export top-level functions and const/let declarations from solution
    let solutionCode = context.code
    // Add export to function declarations that aren't already exported
    solutionCode = solutionCode.replace(/^(function\s+\w+)/gm, 'export $1')
    // Add export to const/let declarations at the start of a line
    solutionCode = solutionCode.replace(/^(const|let)\s+(\w+)\s*=/gm, 'export $1 $2 =')
    // Fix double exports if already exported
    solutionCode = solutionCode.replace(/export\s+export\s+/g, 'export ')

    // Process test code:
    // 1. Remove vitest imports (we use --globals flag)
    // 2. Auto-import from solution if not already imported
    let testCode = context.testCode
      .replace(/import\s*\{[^}]*\}\s*from\s*['"]vitest['"]\s*;?\n?/g, '')
      .replace(/import\s+.*\s+from\s*['"]vitest['"]\s*;?\n?/g, '')

    if (!testCode.includes("from './solution'") && !testCode.includes('from "./solution"')) {
      testCode = `import * as solution from './solution';\nObject.assign(globalThis, solution);\n\n${testCode}`
    }

    // Common files for both Docker and local execution
    const baseFiles = {
      'solution.ts': solutionCode,
      'solution.test.ts': testCode,
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
        // Docker: Use globally installed vitest with CLI flags (no config/package.json needed)
        // Pass the test file pattern as a positional argument
        const result = await executeInDocker(context, baseFiles, [
          'vitest',
          'run',
          '--reporter=json',
          '--globals',
          'solution.test.ts',
        ])
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        // Local: Need package.json and vitest config for npm install
        const localFiles = {
          ...baseFiles,
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
        }
        const workDir = await prepareWorkspace(localFiles)
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
      return match[1]?.trim() ?? ''
    }
  }

  const lines = output.split('\n').filter((l) => l.trim())
  return lines.slice(-5).join('\n') || 'Unknown error'
}

export const typescriptExecutor = new TypeScriptExecutor()
