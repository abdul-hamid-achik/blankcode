export interface TestResult {
  name: string
  passed: boolean
  message: string | null
  duration: number
}

export interface ExecutionResult {
  success: boolean
  status: 'passed' | 'failed' | 'error'
  testResults: TestResult[]
  executionTimeMs: number
  errorMessage?: string
}

export interface ExecutionContext {
  submissionId: string
  exerciseId: string
  code: string
  testCode: string
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'vue' | 'react' | 'node'
  timeoutMs: number
  memoryLimitMb: number
}

export interface LanguageExecutor {
  execute(context: ExecutionContext): Promise<ExecutionResult>
}

export interface SubmissionJobData {
  submissionId: string
  exerciseId: string
  code: string
}
