import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '@/components/ui/button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Click me',
      },
    })

    expect(wrapper.text()).toContain('Click me')
  })

  it('applies primary variant by default', () => {
    const wrapper = mount(Button)

    expect(wrapper.classes()).toContain('bg-primary')
  })

  it('applies secondary variant', () => {
    const wrapper = mount(Button, {
      props: { variant: 'secondary' },
    })

    expect(wrapper.classes()).toContain('bg-secondary')
  })

  it('applies destructive variant', () => {
    const wrapper = mount(Button, {
      props: { variant: 'destructive' },
    })

    expect(wrapper.classes()).toContain('bg-destructive')
  })

  it('applies outline variant', () => {
    const wrapper = mount(Button, {
      props: { variant: 'outline' },
    })

    expect(wrapper.classes()).toContain('border')
  })

  it('applies ghost variant', () => {
    const wrapper = mount(Button, {
      props: { variant: 'ghost' },
    })

    expect(wrapper.classes()).not.toContain('bg-primary')
  })

  it('applies size classes', () => {
    const smWrapper = mount(Button, { props: { size: 'sm' } })
    const mdWrapper = mount(Button, { props: { size: 'md' } })
    const lgWrapper = mount(Button, { props: { size: 'lg' } })

    expect(smWrapper.classes()).toContain('h-8')
    expect(mdWrapper.classes()).toContain('h-10')
    expect(lgWrapper.classes()).toContain('h-12')
  })

  it('is disabled when disabled prop is true', () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('is disabled when loading', () => {
    const wrapper = mount(Button, {
      props: { loading: true },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('shows loading spinner when loading', () => {
    const wrapper = mount(Button, {
      props: { loading: true },
      slots: { default: 'Loading' },
    })

    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('svg').classes()).toContain('animate-spin')
  })

  it('does not show spinner when not loading', () => {
    const wrapper = mount(Button, {
      props: { loading: false },
      slots: { default: 'Click me' },
    })

    expect(wrapper.find('svg.animate-spin').exists()).toBe(false)
  })

  it('emits click event', async () => {
    const wrapper = mount(Button)

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('does not emit click when disabled', async () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toBeFalsy()
  })
})
