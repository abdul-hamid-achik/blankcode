import type { TestResult } from '../types.js'

interface VitestTestResult {
  name?: string
  title?: string
  fullName?: string
  status: 'pass' | 'fail' | 'skip' | 'passed' | 'failed'
  duration?: number
  failureMessages?: string[]
  message?: string
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
    const idx = output.lastIndexOf('"testResults"')
    if (idx === -1) {
      return parseVitestTextOutput(output)
    }

    // Walk backwards to find the start of the JSON object
    let braceCount = 0
    let start = -1
    for (let i = idx; i >= 0; i--) {
      if (output[i] === '}') braceCount++
      if (output[i] === '{') {
        if (braceCount === 0) {
          start = i
          break
        }
        braceCount--
      }
    }

    if (start === -1) return parseVitestTextOutput(output)

    // Walk forward to find the matching closing brace
    braceCount = 0
    let end = -1
    for (let i = start; i < output.length; i++) {
      if (output[i] === '{') braceCount++
      if (output[i] === '}') {
        braceCount--
        if (braceCount === 0) {
          end = i + 1
          break
        }
      }
    }

    if (end === -1) return parseVitestTextOutput(output)

    const json: VitestJsonOutput = JSON.parse(output.slice(start, end))
    const results: TestResult[] = []

    for (const file of json.testResults) {
      for (const test of file.assertionResults) {
        const testName = test.title || test.fullName || test.name || 'Unknown test'
        results.push({
          name: testName,
          passed: test.status === 'pass' || test.status === 'passed',
          message: test.failureMessages?.join('\n') || test.message || null,
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
  const passPattern = /✓\s+(.+?)\s+\((\d+)ms\)/
  const failPattern = /✗\s+(.+?)\s+\((\d+)ms\)/
  let lastFailedIndex: number | null = null

  for (const line of output.split('\n')) {
    const result = parseTestLine(line, passPattern, failPattern)
    if (result) {
      results.push(result)
      lastFailedIndex = result.passed ? null : results.length - 1
      continue
    }

    if (lastFailedIndex !== null) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/^(Test Files|Tests|Snapshots|Duration)/.test(trimmed)) continue
      const target = results[lastFailedIndex]
      if (target) {
        appendMessage(target, trimmed)
      }
    }
  }

  return results
}

function parseTestLine(line: string, passPattern: RegExp, failPattern: RegExp): TestResult | null {
  const passMatch = line.match(passPattern)
  if (passMatch) {
    return {
      name: passMatch[1]?.trim() ?? '',
      passed: true,
      message: null,
      duration: parseInt(passMatch[2] ?? '0', 10),
    }
  }

  const failMatch = line.match(failPattern)
  if (failMatch) {
    return {
      name: failMatch[1]?.trim() ?? '',
      passed: false,
      message: null,
      duration: parseInt(failMatch[2] ?? '0', 10),
    }
  }

  return null
}

export function parsePytestOutput(output: string): TestResult[] {
  const results: TestResult[] = []
  // Verbose format: test_solution.py::test_name PASSED [100%]
  const verbosePattern = /^(.+?)\s+(PASSED|FAILED)(?:\s|$)/
  // Summary format: FAILED test_solution.py::test_name - message
  const summaryFailPattern = /^FAILED\s+(.+?)(?:\s+-\s+(.+))?$/
  const failureDetails = collectPytestFailureDetails(output)
  const seenTests = new Set<string>()

  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('=')) continue

    // Verbose format: lines containing :: are test results
    const verboseMatch = trimmed.match(verbosePattern)
    if (verboseMatch && verboseMatch[1]?.includes('::')) {
      const name = verboseMatch[1].trim()
      const passed = verboseMatch[2] === 'PASSED'
      if (!seenTests.has(name)) {
        seenTests.add(name)
        if (passed) {
          results.push({ name, passed: true, message: null, duration: 0 })
        } else {
          const detailKey = name.split('::').pop() ?? name
          const details = failureDetails.get(name) ?? failureDetails.get(detailKey)
          results.push({ name, passed: false, message: details ?? null, duration: 0 })
        }
      }
      continue
    }

    // Summary format: FAILED test_path::test_name - message
    const summaryMatch = trimmed.match(summaryFailPattern)
    if (summaryMatch) {
      const name = summaryMatch[1]?.trim() ?? ''
      if (!seenTests.has(name)) {
        seenTests.add(name)
        const detailKey = name.split('::').pop() ?? name
        const details = failureDetails.get(name) ?? failureDetails.get(detailKey)
        results.push({
          name,
          passed: false,
          message: details ?? summaryMatch[2]?.trim() ?? null,
          duration: 0,
        })
      }
    }
  }

  return results
}

export function parseGoTestOutput(output: string): TestResult[] {
  const results: TestResult[] = []
  const passPattern = /--- PASS: (.+?) \((\d+(?:\.\d+)?)s\)/
  const failPattern = /--- FAIL: (.+?) \((\d+(?:\.\d+)?)s\)/
  let lastFailedIndex: number | null = null

  for (const line of output.split('\n')) {
    const passMatch = line.match(passPattern)
    if (passMatch) {
      results.push({
        name: passMatch[1]?.trim() ?? '',
        passed: true,
        message: null,
        duration: parseFloat(passMatch[2] ?? '0') * 1000,
      })
      lastFailedIndex = null
      continue
    }

    const failMatch = line.match(failPattern)
    if (failMatch) {
      results.push({
        name: failMatch[1]?.trim() ?? '',
        passed: false,
        message: null,
        duration: parseFloat(failMatch[2] ?? '0') * 1000,
      })
      lastFailedIndex = results.length - 1
      continue
    }

    if (lastFailedIndex !== null && /^\s+/.test(line)) {
      const target = results[lastFailedIndex]
      if (target) {
        appendMessage(target, line.trim())
      }
    }
  }

  return results
}

export function parseCargoTestOutput(output: string): TestResult[] {
  const results: TestResult[] = []
  const passPattern = /test (.+?) \.\.\. ok/
  const failPattern = /test (.+?) \.\.\. FAILED/

  for (const line of output.split('\n')) {
    const passMatch = line.match(passPattern)
    if (passMatch) {
      results.push({
        name: passMatch[1]?.trim() ?? '',
        passed: true,
        message: null,
        duration: 0,
      })
      continue
    }

    const failMatch = line.match(failPattern)
    if (failMatch) {
      results.push({
        name: failMatch[1]?.trim() ?? '',
        passed: false,
        message: null,
        duration: 0,
      })
    }
  }

  return results
}

function appendMessage(result: TestResult, messageLine: string): void {
  const trimmed = messageLine.trim()
  if (!trimmed) return
  if (result.message) {
    result.message = `${result.message}\n${trimmed}`
  } else {
    result.message = trimmed
  }
}

function collectPytestFailureDetails(output: string): Map<string, string> {
  const failureMap = new Map<string, string>()
  const headerPattern = /^_{3,}\s+(.+?)\s+_{3,}\s*$/
  const lines = output.split('\n')
  let currentKey: string | null = null
  let buffer: string[] = []

  const flush = () => {
    if (!currentKey || buffer.length === 0) return
    failureMap.set(currentKey, buffer.join('\n'))
    buffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^=+/.test(trimmed)) {
      flush()
      currentKey = null
      continue
    }

    const headerMatch = line.match(headerPattern)
    if (headerMatch) {
      flush()
      currentKey = headerMatch[1]?.trim() ?? null
      continue
    }

    if (currentKey && trimmed) {
      buffer.push(trimmed)
    }
  }

  flush()
  return failureMap
}
