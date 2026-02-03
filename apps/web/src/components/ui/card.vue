<script setup lang="ts">
interface Props {
  padding?: boolean
}

withDefaults(defineProps<Props>(), {
  padding: true,
})
</script>

<template>
  <div class="w-full rounded-xl border border-border bg-muted/50">
    <div :class="['w-full', { 'p-6': padding }]">
      <slot />
    </div>
  </div>
</template>
