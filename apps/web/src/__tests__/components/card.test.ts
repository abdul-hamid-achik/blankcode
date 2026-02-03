import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Card from '@/components/ui/card.vue'

describe('Card', () => {
  it('renders slot content', () => {
    const wrapper = mount(Card, {
      slots: {
        default: '<p>Card content</p>',
      },
    })

    expect(wrapper.text()).toContain('Card content')
  })

  it('applies padding by default', () => {
    const wrapper = mount(Card)

    expect(wrapper.find('div > div').classes()).toContain('p-6')
  })

  it('does not apply padding when padding is false', () => {
    const wrapper = mount(Card, {
      props: { padding: false },
    })

    expect(wrapper.find('div > div').classes()).not.toContain('p-6')
  })

  it('has border and background styling', () => {
    const wrapper = mount(Card)

    expect(wrapper.classes()).toContain('border')
    expect(wrapper.classes()).toContain('rounded-xl')
  })
})
