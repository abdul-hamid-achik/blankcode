import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Button from '~/components/ui/button.vue'

/**
 * The exercise page leans on `loading` to block a second submission while
 * tests are still running, so the disabled contract is worth pinning down.
 */
describe('Button', () => {
  it('renders its slot content', () => {
    const wrapper = mount(Button, { slots: { default: 'Run Tests' } })
    expect(wrapper.text()).toContain('Run Tests')
  })

  it('is enabled by default', () => {
    const wrapper = mount(Button)
    expect(wrapper.attributes('disabled')).toBeUndefined()
  })

  it('disables itself while loading, not just visually', () => {
    const wrapper = mount(Button, { props: { loading: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.find('svg.animate-spin').exists()).toBe(true)
  })

  it('disables itself when explicitly disabled', () => {
    const wrapper = mount(Button, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.find('svg.animate-spin').exists()).toBe(false)
  })

  it('does not emit click while disabled', async () => {
    const wrapper = mount(Button, { props: { disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('applies the variant and size classes', () => {
    const wrapper = mount(Button, { props: { variant: 'destructive', size: 'lg' } })
    const classes = wrapper.attributes('class') ?? ''
    expect(classes).toContain('bg-destructive')
    expect(classes).toContain('h-12')
  })

  it('defaults to the primary variant at medium size', () => {
    const classes = mount(Button).attributes('class') ?? ''
    expect(classes).toContain('bg-primary')
    expect(classes).toContain('h-10')
  })

  it('renders a link instead of nesting a button when given to or href', () => {
    const internal = mount(Button, { props: { to: '/login' }, slots: { default: 'Sign in' } })
    expect(internal.find('button').exists()).toBe(false)
    expect(internal.text()).toContain('Sign in')

    const external = mount(Button, {
      props: { href: '/api/oauth/github/start' },
      slots: { default: 'GitHub' },
    })
    expect(external.element.tagName.toLowerCase()).toBe('a')
    expect(external.attributes('href')).toBe('/api/oauth/github/start')
  })
})
