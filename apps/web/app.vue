<script setup lang="ts">
import { useThemeClass } from '~/composables/useThemeClass'

useThemeClass()

// Every page gets the product name without repeating it in each view. The
// function form lives here rather than in nuxt.config, which only takes a
// string template and so cannot express "no suffix when there is no title".
useHead({
  titleTemplate: (title?: string) => {
    if (!title) return 'BlankCode'
    // The landing page names the product in its own title; appending it again
    // gives 'BlankCode — … · BlankCode'.
    return title.includes('BlankCode') ? title : `${title} · BlankCode`
  },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
