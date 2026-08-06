<script setup lang="ts">
import type { TestResult } from '@blankcode/shared'
import TestResults from './test-results.vue'

const passing: TestResult[] = [
  { name: 'returns 0 for n = 0', passed: true, duration: 0.4 },
  { name: 'returns 1 for n = 1', passed: true, duration: 0.2 },
  { name: 'returns 55 for n = 10', passed: true, duration: 1.8 },
] as TestResult[]

const mixed: TestResult[] = [
  { name: 'returns 0 for n = 0', passed: true, duration: 0.4 },
  {
    name: 'returns 55 for n = 10',
    passed: false,
    duration: 2.1,
    message:
      'AssertionError: expected 89 to be 55\n\n- Expected\n+ Received\n\n- 55\n+ 89\n    at /app/fibonacci.test.ts:12:24',
  },
] as TestResult[]

// A stack trace long enough to exercise the node_modules filtering and the
// 10-line truncation in `formatMessage`.
const noisy: TestResult[] = [
  {
    name: 'handles large input',
    passed: false,
    duration: 5,
    message: [
      'RangeError: Maximum call stack size exceeded',
      '    at fibonacci (/app/fibonacci.ts:4:10)',
      ...Array.from(
        { length: 12 },
        (_, i) => `    at /app/node_modules/vitest/dist/chunk-${i}.js:1:1`
      ),
      '    at runTest (/app/fibonacci.test.ts:20:3)',
    ].join('\n'),
  },
] as TestResult[]
</script>

<template>
  <Story title="TestResults" group="exercise" :layout="{ type: 'grid', width: 460 }">
    <Variant title="All passing">
      <TestResults status="passed" :results="passing" :execution-time="412" />
    </Variant>

    <Variant title="Some failing">
      <TestResults status="failed" :results="mixed" :execution-time="905" />
    </Variant>

    <Variant title="Noisy stack trace">
      <TestResults status="failed" :results="noisy" :execution-time="5200" />
    </Variant>

    <Variant title="Compile / runtime error">
      <TestResults
        status="error"
        :results="null"
        error-message="SyntaxError: Unexpected token '}' at line 7"
      />
    </Variant>

    <Variant title="Timed out">
      <TestResults
        status="error"
        :results="null"
        timed-out
        error-message="Execution exceeded the 60s limit"
      />
    </Variant>

    <Variant title="Queued">
      <TestResults status="pending" :results="null" />
    </Variant>

    <Variant title="Running">
      <TestResults status="running" :results="null" />
    </Variant>
  </Story>
</template>
