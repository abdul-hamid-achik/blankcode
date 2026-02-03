import type { TestResult } from '../types.js'

interface VitestTestResult {
  name: string
  status: 'pass' | 'fail' | 'skip'
  duration?: number
  failureMessages?: string[]
}

interface VitestSuiteResult {
  name: string
  tests: VitestTestResult[]
}

interface VitestJsonOutput {
  numTotalTests: number
  numPassedTests: number
  numFailedTests: number
  success: boolean
  testResults: Array<{
    name: string
    assertionResults: VitestTestResult[]
  }>
}

export function parseVitestOutput(output: string): TestResult[] {
  try {
    const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/)
    if (!jsonMatch) {
      return parseVitestTextOutput(output)
    }

    const json: VitestJsonOutput = JSON.parse(jsonMatch[0])
    const results: TestResult[] = []

    for (const file of json.testResults) {
      for (const test of file.assertionResults) {
        results.push({
          name: test.name,
          passed: test.status === 'pass',
          message: test.failureMessages?.join('\n') ?? null,
          duration: test.duration ?? 0,
        })
      }
    }

    return results
  } catch {
    return parseVitestTextOutput(output)
  }
}

function parseVitestTextOutput(output: string): TestResult[] {
  const results: TestResult[] = []
  const lines = output.split('\n')

  const passPattern = /✓\s+(.+?)\s+\((\d+)ms\)/
  const failPattern = /✗\s+(.+?)\s+\((\d+)ms\)/
  const errorPattern = /Error:\s+(.+)/

  let currentFailureMessage = ''

  for (const line of lines) {
    const passMatch = line.match(passPattern)
    if (passMatch) {
      results.push({
        name: passMatch[1]!.trim(),
        passed: true,
        message: null,
        duration: parseInt(passMatch[2]!, 10),
      })
      continue
    }

    const failMatch = line.match(failPattern)
    if (failMatch) {
      currentFailureMessage = ''
      results.push({
        name: failMatch[1]!.trim(),
        passed: false,
        message: null,
        duration: parseInt(failMatch[2]!, 10),
      })
      continue
    }

    const errorMatch = line.match(errorPattern)
    if (errorMatch && results.length > 0) {
      const lastResult = results[results.length - 1]!
      if (!lastResult.passed && !lastResult.message) {
        lastResult.message = errorMatch[1]!.trim()
      }
    }
  }

  return results
}

export function parsePytestOutput(output: string): TestResult[] {
  const results: TestResult[] = []
  const lines = output.split('\n')

  const passPattern = /PASSED\s+(.+?)\s*(?:\((\d+(?:\.\d+)?)s\))?/
  const failPattern = /FAILED\s+(.+?)\s*(?:-\s*(.+))?/

  for (const line of lines) {
    const passMatch = line.match(passPattern)
    if (passMatch) {
      results.push({
        name: passMatch[1]!.trim(),
        passed: true,
        message: null,
        duration: passMatch[2] ? parseFloat(passMatch[2]) * 1000 : 0,
      })
      continue
    }

    const failMatch = line.match(failPattern)
    if (failMatch) {
      results.push({
        name: failMatch[1]!.trim(),
        passed: false,
        message: failMatch[2]?.trim() ?? null,
        duration: 0,
      })
    }
  }

  return results
}

export function parseGoTestOutput(output: string): TestResult[] {
  const results: TestResult[] = []
  const lines = output.split('\n')

  const passPattern = /--- PASS: (.+?) \((\d+(?:\.\d+)?)s\)/
  const failPattern = /--- FAIL: (.+?) \((\d+(?:\.\d+)?)s\)/

  for (const line of lines) {
    const passMatch = line.match(passPattern)
    if (passMatch) {
      results.push({
        name: passMatch[1]!.trim(),
        passed: true,
        message: null,
        duration: parseFloat(passMatch[2]!) * 1000,
      })
      continue
    }

    const failMatch = line.match(failPattern)
    if (failMatch) {
      results.push({
        name: failMatch[1]!.trim(),
        passed: false,
        message: null,
        duration: parseFloat(failMatch[2]!) * 1000,
      })
    }
  }

  return results
}

export function parseCargoTestOutput(output: string): TestResult[] {
  const results: TestResult[] = []
  const lines = output.split('\n')

  const passPattern = /test (.+?) \.\.\. ok/
  const failPattern = /test (.+?) \.\.\. FAILED/

  for (const line of lines) {
    const passMatch = line.match(passPattern)
    if (passMatch) {
      results.push({
        name: passMatch[1]!.trim(),
        passed: true,
        message: null,
        duration: 0,
      })
      continue
    }

    const failMatch = line.match(failPattern)
    if (failMatch) {
      results.push({
        name: failMatch[1]!.trim(),
        passed: false,
        message: null,
        duration: 0,
      })
    }
  }

  return results
}
