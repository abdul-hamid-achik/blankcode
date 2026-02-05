import { describe, expect, it } from 'vitest'
import {
  parseGoTestOutput,
  parsePytestOutput,
  parseVitestOutput,
} from '../../services/execution/parsers/vitest.parser.js'

describe('vitest parser failure messages', () => {
  it('captures vitest text failure block', () => {
    const output = [
      '✗ adds numbers (4ms)',
      'AssertionError: expected 3 to be 4',
      '  at adds numbers (solution.test.ts:10:5)',
      '✓ handles zeros (2ms)',
      'Test Files  1 failed',
    ].join('\n')

    const results = parseVitestOutput(output)

    expect(results).toHaveLength(2)
    expect(results[0]?.passed).toBe(false)
    expect(results[0]?.message).toContain('AssertionError: expected 3 to be 4')
    expect(results[0]?.message).toContain('at adds numbers')
  })

  it('captures go test failure details', () => {
    const output = [
      '--- FAIL: TestSum (0.00s)',
      '    sum_test.go:12: expected 4 got 3',
      '--- PASS: TestZero (0.00s)',
      'FAIL',
    ].join('\n')

    const results = parseGoTestOutput(output)

    expect(results).toHaveLength(2)
    expect(results[0]?.passed).toBe(false)
    expect(results[0]?.message).toContain('sum_test.go:12: expected 4 got 3')
  })

  it('captures pytest failure details', () => {
    const output = [
      '______________________________ test_add ______________________________',
      'def test_add():',
      '>       assert add(1, 2) == 4',
      'E       assert 3 == 4',
      'test_solution.py:6: AssertionError',
      'FAILED test_solution.py::test_add - AssertionError',
      '',
      '=========================== short test summary info ===========================',
      'FAILED test_solution.py::test_add - AssertionError',
    ].join('\n')

    const results = parsePytestOutput(output)

    expect(results).toHaveLength(1)
    expect(results[0]?.passed).toBe(false)
    expect(results[0]?.message).toContain('assert add(1, 2) == 4')
    expect(results[0]?.message).toContain('AssertionError')
  })
})
