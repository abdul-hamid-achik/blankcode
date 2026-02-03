import { config } from '../../../config/index.js'
import { parsePytestOutput } from '../parsers/vitest.parser.js'
import { cleanupWorkspace, executeInDocker, executeLocally, prepareWorkspace } from '../sandbox.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

export class PythonExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()

    // Auto-import from solution if test doesn't already import it
    let testCode = context.testCode
    if (!testCode.includes('from solution import') && !testCode.includes('import solution')) {
      testCode = `from solution import *\n\n${testCode}`
    }

    const files = {
      'solution.py': context.code,
      'test_solution.py': testCode,
      'pytest.ini': `[pytest]
testpaths = .
python_files = test_*.py
python_functions = test_*
addopts = -v --tb=short
`,
    }

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (config.execution.dockerEnabled) {
        const result = await executeInDocker(context, files, ['pytest', '-v'])
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode
      } else {
        const workDir = await prepareWorkspace(files)
        try {
          const testResult = await executeLocally('pytest', ['-v'], workDir, context.timeoutMs)
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

      const testResults = parsePytestOutput(output)

      if (testResults.length === 0 && exitCode !== 0) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: extractPythonError(output),
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

function extractPythonError(output: string): string {
  const errorPatterns = [
    /SyntaxError: (.+)/i,
    /IndentationError: (.+)/i,
    /NameError: (.+)/i,
    /TypeError: (.+)/i,
    /ValueError: (.+)/i,
    /ImportError: (.+)/i,
    /AttributeError: (.+)/i,
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

export const pythonExecutor = new PythonExecutor()
