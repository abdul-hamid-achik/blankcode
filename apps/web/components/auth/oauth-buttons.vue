<script setup lang="ts">
import Button from '~/components/ui/button.vue'

/**
 * GitHub / Google on the door, not only after you are already inside.
 * The start route stores `next` in a short-lived cookie so the callback
 * can send a guest back to the exercise they picked.
 */

const props = defineProps<{
  redirect?: string
}>()

function href(provider: 'github' | 'google'): string {
  const next = props.redirect
  if (!next || next === '/dashboard' || next === '/tracks') return `/api/oauth/${provider}/start`
  return `/api/oauth/${provider}/start?next=${encodeURIComponent(next)}`
}
</script>

<template>
  <div>
    <p class="mb-3 text-center font-mono text-xs text-muted-foreground">or</p>
    <div class="grid grid-cols-2 gap-2">
      <a :href="href('github')">
        <Button variant="outline" type="button" class="w-full">GitHub</Button>
      </a>
      <a :href="href('google')">
        <Button variant="outline" type="button" class="w-full">Google</Button>
      </a>
    </div>
  </div>
</template>
