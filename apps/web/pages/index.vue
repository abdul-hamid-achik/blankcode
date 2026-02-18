<script setup lang="ts">
import DemoMockup from '~/components/landing/demo-mockup.vue'
import FeaturesGrid from '~/components/landing/features-grid.vue'
import FinalCta from '~/components/landing/final-cta.vue'
import HeroSection from '~/components/landing/hero-section.vue'
import LanguageShowcase from '~/components/landing/language-showcase.vue'
import SocialProofBar from '~/components/landing/social-proof-bar.vue'
</script>

<template>
  <div>
    <HeroSection />
    <SocialProofBar />
    <DemoMockup />
    <FeaturesGrid />
    <LanguageShowcase />
    <FinalCta />
  </div>
</template>
