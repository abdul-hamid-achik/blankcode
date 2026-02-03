import { config } from '../../config/index.js'
import { typescriptExecutor, pythonExecutor, goExecutor, rustExecutor } from './executors/index.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from './types.js'

const executors: Record<string, LanguageExecutor> = {
  typescript: typescriptExecutor,
  javascript: typescriptExecutor,
  python: pythonExecutor,
  go: goExecutor,
  rust: rustExecutor,
}

export class ExecutionService {
  async execute(
    submissionId: string,
    exerciseId: string,
    code: string,
    testCode: string,
    language: string
  ): Promise<ExecutionResult> {
    const executor = executors[language]

    if (!executor) {
      return {
        success: false,
        status: 'error',
        testResults: [],
        executionTimeMs: 0,
        errorMessage: `Unsupported language: ${language}`,
      }
    }

    const context: ExecutionContext = {
      submissionId,
      exerciseId,
      code,
      testCode,
      language: language as ExecutionContext['language'],
      timeoutMs: config.execution.timeoutMs,
      memoryLimitMb: config.execution.memoryLimitMb,
    }

    return executor.execute(context)
  }
}

export const executionService = new ExecutionService()
