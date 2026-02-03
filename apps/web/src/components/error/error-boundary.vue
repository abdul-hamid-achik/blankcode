<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import Button from '@/components/ui/button.vue'

const props = withDefaults(
  defineProps<{
    fallbackMessage?: string
  }>(),
  {
    fallbackMessage: 'Something went wrong. Please try again.',
  }
)

const emit = defineEmits<{
  error: [error: Error]
}>()

const error = ref<Error | null>(null)
const hasError = ref(false)

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  hasError.value = true
  emit('error', error.value)
  return false
})

function reset() {
  error.value = null
  hasError.value = false
}
</script>

<template>
  <div v-if="hasError" class="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
    <div class="flex flex-col items-center text-center">
      <div class="text-4xl mb-4">!</div>
      <p class="text-destructive font-medium mb-2">{{ fallbackMessage }}</p>
      <p v-if="error?.message" class="text-sm text-muted-foreground mb-4">
        {{ error.message }}
      </p>
      <Button variant="outline" size="sm" @click="reset">
        Try Again
      </Button>
    </div>
  </div>
  <slot v-else />
</template>
