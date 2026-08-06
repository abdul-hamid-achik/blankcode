import './assets/css/main.css'

/**
 * Histoire renders components outside Nuxt, so two things have to be recreated
 * here: the Tailwind theme (imported above) and the handful of Nuxt globals
 * that presentational components touch.
 */
import { defineSetupVue3 } from '@histoire/plugin-vue'
import { defineComponent, h } from 'vue'

// `NuxtLink` is provided by Nuxt at runtime; in stories render a plain anchor
// so navigation-flavoured components still lay out correctly.
const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: {
    to: { type: [String, Object], default: '#' },
  },
  setup(props, { slots }) {
    return () =>
      h('a', { href: typeof props.to === 'string' ? props.to : '#' }, slots['default']?.())
  },
})

export const setupVue3 = defineSetupVue3(({ app }) => {
  app.component('NuxtLink', NuxtLinkStub)
})
