import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskBriefPanel from '~/components/exercise/task-brief-panel.vue'
import { AUTHORED_BRIEFS } from '~/utils/authored-briefs'
import { presentTaskBrief } from '~/utils/task-brief'

describe('TaskBriefPanel', () => {
  it('renders the same review brief the transform produces', () => {
    const expected = presentTaskBrief({
      type: 'review',
      description: 'one-liner',
      authoredBrief: AUTHORED_BRIEFS['ts-review-001'],
    })

    const wrapper = mount(TaskBriefPanel, {
      props: {
        type: 'review',
        description: 'one-liner',
        slug: 'ts-review-001',
      },
    })

    expect(wrapper.text()).toContain(expected.framing)
    expect(wrapper.text()).toContain('silently returns fewer records')
    expect(wrapper.text()).not.toContain('## Solution')
    expect(wrapper.text()).not.toContain('Math.ceil')
  })

  it('renders the challenge requirements, not the hidden tests', () => {
    const wrapper = mount(TaskBriefPanel, {
      props: {
        type: 'challenge',
        description: 'Implement a counter.',
        slug: 'ts-challenge-001',
      },
    })

    expect(wrapper.text()).toMatch(/stub|Implement/i)
    expect(wrapper.text()).toContain('Private count property')
    expect(wrapper.text()).not.toContain('should throw error when decrement')
  })

  it('does not add framing on a blank exercise', () => {
    const wrapper = mount(TaskBriefPanel, {
      props: {
        type: 'blank',
        description: 'Fill in the missing type parameter.',
      },
    })

    expect(wrapper.text()).toBe('Fill in the missing type parameter.')
    expect(wrapper.text()).not.toMatch(/defect|stub/i)
  })
})
