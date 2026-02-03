<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { BlankRegion } from '@blankcode/shared'

interface Props {
  code: string
  blanks?: BlankRegion[]
  readonly?: boolean
  language?: string
}

const props = withDefaults(defineProps<Props>(), {
  blanks: () => [],
  readonly: false,
  language: 'typescript',
})

const emit = defineEmits<{
  'update:code': [value: string]
  submit: []
}>()

const editorRef = ref<HTMLTextAreaElement | null>(null)
const lines = computed(() => props.code.split('\n'))

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:code', target.value)
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    event.preventDefault()
    const target = event.target as HTMLTextAreaElement
    const start = target.selectionStart
    const end = target.selectionEnd
    const newValue = props.code.substring(0, start) + '  ' + props.code.substring(end)
    emit('update:code', newValue)
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = start + 2
    })
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    emit('submit')
  }
}
</script>

<template>
  <div class="relative rounded-lg border border-border bg-code-bg overflow-hidden">
    <div class="flex text-sm">
      <div class="flex-shrink-0 w-12 py-4 text-right pr-4 select-none bg-code-bg border-r border-border">
        <div
          v-for="(_, index) in lines"
          :key="index"
          class="leading-6 text-code-line-number"
        >
          {{ index + 1 }}
        </div>
      </div>
      <div class="flex-1 relative">
        <textarea
          ref="editorRef"
          :value="code"
          :readonly="readonly"
          class="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 bg-transparent text-foreground resize-none focus:outline-none"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          @input="handleInput"
          @keydown="handleKeyDown"
        />
      </div>
    </div>
    <div class="absolute bottom-2 right-2 text-xs text-muted-foreground">
      {{ language }} | Ctrl+Enter to submit
    </div>
  </div>
</template>
