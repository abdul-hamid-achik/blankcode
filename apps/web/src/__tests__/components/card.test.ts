import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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
    const innerDiv = wrapper.find('.w-full.rounded-xl > div')
    expect(innerDiv.classes()).toContain('p-6')
  })

  it('does not apply padding when padding is false', () => {
    const wrapper = mount(Card, {
      props: { padding: false },
    })

    const innerDiv = wrapper.find('.w-full.rounded-xl > div')
    expect(innerDiv.classes()).not.toContain('p-6')
  })

  it('has border and background styling', () => {
    const wrapper = mount(Card)

    expect(wrapper.classes()).toContain('border')
    expect(wrapper.classes()).toContain('rounded-xl')
  })
})
