import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Input from '@/components/ui/input.vue'

describe('Input', () => {
  it('renders an input element', () => {
    const wrapper = mount(Input)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('sets input type', () => {
    const wrapper = mount(Input, {
      props: { type: 'email' },
    })

    expect(wrapper.find('input').attributes('type')).toBe('email')
  })

  it('uses text type by default', () => {
    const wrapper = mount(Input)
    expect(wrapper.find('input').attributes('type')).toBe('text')
  })

  it('binds modelValue', () => {
    const wrapper = mount(Input, {
      props: { modelValue: 'test value' },
    })

    expect(wrapper.find('input').element.value).toBe('test value')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(Input)
    const input = wrapper.find('input')

    await input.setValue('new value')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['new value'])
  })

  it('sets placeholder', () => {
    const wrapper = mount(Input, {
      props: { placeholder: 'Enter text' },
    })

    expect(wrapper.find('input').attributes('placeholder')).toBe('Enter text')
  })

  it('is disabled when disabled prop is true', () => {
    const wrapper = mount(Input, {
      props: { disabled: true },
    })

    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })

  it('shows error message when error prop is set', () => {
    const wrapper = mount(Input, {
      props: { error: 'This field is required' },
    })

    expect(wrapper.text()).toContain('This field is required')
  })

  it('does not show error message when no error', () => {
    const wrapper = mount(Input, {
      props: { error: '' },
    })

    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('applies error styling when error is present', () => {
    const wrapper = mount(Input, {
      props: { error: 'Error' },
    })

    expect(wrapper.find('input').classes()).toContain('border-destructive')
  })

  it('does not apply error styling when no error', () => {
    const wrapper = mount(Input, {
      props: { error: '' },
    })

    expect(wrapper.find('input').classes()).not.toContain('border-destructive')
  })
})
