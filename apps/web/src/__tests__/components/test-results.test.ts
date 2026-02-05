import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TestResults from '@/components/editor/test-results.vue'

describe('TestResults', () => {
  it('shows pending state when status is pending', () => {
    const wrapper = mount(TestResults, {
      props: {
        status: 'pending',
        results: null,
      },
    })

    expect(wrapper.text()).toContain('Queued for execution...')
  })

  it('shows running state when status is running', () => {
    const wrapper = mount(TestResults, {
      props: {
        status: 'running',
        results: null,
      },
    })

    expect(wrapper.text()).toContain('Running tests...')
  })

  it('shows timeout state with retry button when timedOut is true', () => {
    const wrapper = mount(TestResults, {
      props: {
        status: 'pending',
        results: null,
        timedOut: true,
      },
    })

    expect(wrapper.text()).toContain('Submission timed out')
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.text()).toContain('Retry')
  })

  it('emits retry when button is clicked', async () => {
    const wrapper = mount(TestResults, {
      props: {
        status: 'pending',
        results: null,
        timedOut: true,
      },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('retry')).toBeTruthy()
  })

  it('shows passed state with test counts', () => {
    const wrapper = mount(TestResults, {
      props: {
        status: 'passed',
        results: [
          { name: 'test 1', passed: true, message: null, duration: 10 },
          { name: 'test 2', passed: true, message: null, duration: 15 },
        ],
        executionTime: 100,
      },
    })

    expect(wrapper.text()).toContain('Passed')
    expect(wrapper.text()).toContain('2/2 tests passed')
  })

  it('shows failed state with test results', () => {
    const wrapper = mount(TestResults, {
      props: {
        status: 'failed',
        results: [
          { name: 'test 1', passed: true, message: null, duration: 10 },
          { name: 'test 2', passed: false, message: 'Expected 42 but got 0', duration: 5 },
        ],
        executionTime: 50,
      },
    })

    expect(wrapper.text()).toContain('Failed')
    expect(wrapper.text()).toContain('1/2 tests passed')
  })

  it('shows error state with error message', () => {
    const wrapper = mount(TestResults, {
      props: {
        status: 'error',
        results: [],
        errorMessage: 'SyntaxError: Unexpected token',
      },
    })

    expect(wrapper.text()).toContain('Execution Error')
    expect(wrapper.text()).toContain('SyntaxError')
  })

  it('does not show "undefinedms" when duration is null', () => {
    const wrapper = mount(TestResults, {
      props: {
        status: 'passed',
        results: [{ name: 'test 1', passed: true, message: null, duration: null as any }],
      },
    })
    expect(wrapper.text()).not.toContain('undefinedms')
    expect(wrapper.text()).not.toContain('nullms')
  })
})
