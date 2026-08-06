<script setup lang="ts">
interface Props {
  padding?: boolean
  /** Draws the left signal rule used to mark the thing you should act on. */
  marked?: boolean
}

withDefaults(defineProps<Props>(), {
  padding: true,
  marked: false,
})
</script>

<template>
  <div
    class="w-full border bg-card"
    :class="marked ? 'border-rule border-l-2 border-l-signal' : 'border-rule'"
  >
    <div :class="['w-full', { 'p-5': padding }]">
      <slot />
    </div>
  </div>
</template>
