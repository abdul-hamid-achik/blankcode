<script setup lang="ts">
import { useThemeClass } from '~/composables/useThemeClass'

useThemeClass()

// Every page gets the product name without repeating it in each view. The
// function form lives here rather than in nuxt.config, which only takes a
// string template and so cannot express "no suffix when there is no title".
useHead({
  titleTemplate: (title?: string) => (title ? `${title} · BlankCode` : 'BlankCode'),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
