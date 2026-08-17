<script setup lang="ts">
import type { NuxtError } from '#app'
import { computed } from 'vue'
import Button from '~/components/ui/button.vue'
import { useThemeClass } from '~/composables/useThemeClass'
import { type ErrorAction, copyForStatus } from '~/utils/error-copy'

const props = defineProps<{ error: NuxtError }>()

// The error page replaces the whole app tree, so it has to re-apply the theme.
useThemeClass()

const statusCode = computed(() => Number(props.error?.statusCode) || 500)
const copy = computed(() => copyForStatus(statusCode.value))

/** The raw message is useful when developing and noise otherwise. */
const detail = computed(() => {
  const message = props.error?.message?.trim()
  if (!message || message === copy.value.title) return null
  return message
})

const isDev = import.meta.dev

function handle(action: ErrorAction) {
  if (action.reload) {
    clearError({ redirect: useRoute().fullPath })
    return
  }
  let to = action.to ?? '/'
  if (action.redirect && to === '/login') {
    const here = useRoute().fullPath
    if (here && !here.startsWith('/login')) {
      to = `/login?redirect=${encodeURIComponent(here)}`
    }
  }
  clearError({ redirect: to })
}

useHead({ title: `${statusCode.value} — ${copy.value.eyebrow}` })
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col">
    <div class="sheet sheet-fade absolute inset-0 pointer-events-none" aria-hidden="true" />

    <main class="relative flex-1 flex items-center">
      <div class="container max-w-2xl py-24">
        <p class="eyebrow mb-6">{{ copy.eyebrow }}</p>

        <!-- The status code is rendered as a filled-in blank: the product's
             core gesture, reused as the error page's signature. -->
        <p class="display text-[clamp(4rem,16vw,8rem)] leading-none mb-10" aria-hidden="true">
          <span class="blank-slot blank-slot--display">{{ statusCode }}</span>
        </p>
        <h1 class="sr-only">{{ statusCode }} — {{ copy.title }}</h1>

        <p class="display text-2xl md:text-3xl mb-4">{{ copy.title }}</p>

        <p class="text-base text-muted-foreground max-w-prose leading-relaxed mb-8">
          {{ copy.body }}
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <Button
            v-for="(action, i) in copy.actions"
            :key="action.label"
            :variant="i === 0 ? 'primary' : 'outline'"
            @click="handle(action)"
          >
            {{ action.label }}
          </Button>
        </div>

        <details v-if="detail && isDev" class="mt-10 border-t border-rule pt-6">
          <summary class="eyebrow cursor-pointer select-none">technical detail</summary>
          <pre
            class="mt-4 overflow-x-auto rounded bg-muted p-4 font-mono text-xs leading-relaxed text-muted-foreground"
            >{{ detail }}</pre>
        </details>
      </div>
    </main>
  </div>
</template>
