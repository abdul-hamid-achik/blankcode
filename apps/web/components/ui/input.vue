<script setup lang="ts">
import { computed, useId } from 'vue'

interface Props {
  modelValue?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  id?: string
  label?: string
  /** When true, the label is rendered visually-hidden but still announced. */
  srOnlyLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
  srOnlyLabel: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const autoId = useId()
const inputId = computed(() => props.id ?? `input-${autoId}`)
const errorId = computed(() => `${inputId.value}-error`)

const classes = computed(() => {
  const base =
    'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

  const errorClass = props.error
    ? 'border-destructive focus-visible:ring-destructive'
    : 'border-input'

  return [base, errorClass].join(' ')
})

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<script lang="ts">
export default { inheritAttrs: false }
</script>

<template>
  <div class="space-y-1">
    <label
      v-if="label"
      :for="inputId"
      :class="srOnlyLabel ? 'sr-only' : 'text-sm font-medium block'"
    >
      {{ label }}
    </label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="classes"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : undefined"
      v-bind="$attrs"
      @input="onInput"
    />
    <p v-if="error" :id="errorId" class="text-sm text-destructive" role="alert">{{ error }}</p>
  </div>
</template>
