<script setup lang="ts">
import { computed } from 'vue'
import type { BlankRegion } from '@blankcode/shared'

interface Props {
  blank: BlankRegion
  value: string
  focused?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  focused: false,
})

const emit = defineEmits<{
  'update:value': [value: string]
  focus: []
  blur: []
}>()

const inputWidth = computed(() => {
  const minWidth = 60
  const charWidth = 9
  const padding = 16
  return Math.max(minWidth, props.value.length * charWidth + padding)
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:value', target.value)
}
</script>

<template>
  <span class="inline-flex items-center">
    <input
      type="text"
      :value="value"
      :placeholder="blank.placeholder"
      :style="{ width: `${inputWidth}px` }"
      class="inline-block h-6 px-2 text-sm font-mono bg-code-blank-bg border border-code-blank rounded text-code-blank focus:outline-none focus:ring-1 focus:ring-code-blank"
      @input="handleInput"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
  </span>
</template>
