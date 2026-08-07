<script setup lang="ts">
import LanguageShowcase from '~/components/landing/language-showcase.vue'
import PracticeHero from '~/components/landing/practice-hero.vue'
import PracticeLoop from '~/components/landing/practice-loop.vue'
import ProductFrame from '~/components/landing/product-frame.vue'
import PricingPlans from '~/components/landing/pricing-plans.vue'
import StartPractising from '~/components/landing/start-practising.vue'
import { usePageSeo } from '~/composables/usePageSeo'

usePageSeo({
  title: 'BlankCode — keep your hands from forgetting',
  description:
    "Read almost-finished code, fill in the blanks, and run the exercise's real test suite in an isolated sandbox. Spaced repetition brings each exercise back before you forget it. Nothing to install.",
  path: '/',
})
</script>

<template>
  <div>
    <PracticeHero />
    <ProductFrame />
    <PracticeLoop />
    <LanguageShowcase />
    <PricingPlans />
    <StartPractising />
  </div>
</template>
