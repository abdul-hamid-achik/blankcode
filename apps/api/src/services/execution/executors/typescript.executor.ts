import { config } from '../../../config/index.js'
import { parseVitestOutput } from '../parsers/vitest.parser.js'
import { cleanupWorkspace, executeInDocker, executeLocally, prepareWorkspace } from '../sandbox.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

export class TypeScriptExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()
    const isReact = context.language === 'react'
    const ext = isReact ? '.tsx' : '.ts'

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

    if (isReact) {
      // Rewrite component imports like from './Counter' to from './solution'
      testCode = testCode.replace(/from\s+['"]\.\/(?!solution)[^'"]+['"]/g, "from './solution'")
    } else {
      if (!testCode.includes("from './solution'") && !testCode.includes('from "./solution"')) {
        testCode = `import * as solution from './solution';\nObject.assign(globalThis, solution);\n\n${testCode}`
      }
    }

    const tsconfigOptions = {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      ...(isReact ? { jsx: 'react-jsx' as const } : {}),
    }

    // Common files for both Docker and local execution
    const baseFiles: Record<string, string> = {
      [`solution${ext}`]: solutionCode,
      [`solution.test${ext}`]: testCode,
      'tsconfig.json': JSON.stringify({ compilerOptions: tsconfigOptions }),
    }

    if (isReact) {
      baseFiles['setup.ts'] = `import '@testing-library/jest-dom';\n`
      baseFiles['vitest.config.ts'] = [
        `import { defineConfig } from 'vitest/config';`,
        `export default defineConfig({`,
        `  test: {`,
        `    globals: true,`,
        `    environment: 'jsdom',`,
        `    setupFiles: ['./setup.ts'],`,
        `  },`,
        `});`,
      ].join('\n')
    }

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (config.execution.dockerEnabled) {
        const command = isReact
          ? [
              'vitest',
              'run',
              '--reporter=json',
              '--config',
              'vitest.config.ts',
              `solution.test${ext}`,
            ]
          : ['vitest', 'run', '--reporter=json', '--globals', `solution.test${ext}`]

        const result = await executeInDocker(context, baseFiles, command)
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        // Local: Need package.json and vitest config for npm install
        const localDeps: Record<string, string> = {
          vitest: '^2.0.0',
          typescript: '^5.0.0',
        }
        if (isReact) {
          Object.assign(localDeps, {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            '@types/react': '^18.0.0',
            '@types/react-dom': '^18.0.0',
            '@testing-library/react': '^14.0.0',
            '@testing-library/jest-dom': '^6.0.0',
            jsdom: '^24.0.0',
          })
        }

        const localFiles: Record<string, string> = {
          ...baseFiles,
          'package.json': JSON.stringify({
            name: 'test-runner',
            type: 'module',
            scripts: {
              test: isReact
                ? `vitest run --reporter=json --config vitest.config.ts`
                : 'vitest run --reporter=json',
            },
            devDependencies: localDeps,
          }),
        }

        if (!isReact) {
          localFiles['vitest.config.ts'] = `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    globals: true,
    reporters: ['json'],
    outputFile: './results.json',
  },
})
`
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
