<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { go } from '@codemirror/lang-go'
import { vue } from '@codemirror/lang-vue'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { closeBrackets } from '@codemirror/autocomplete'
import { history, historyKeymap } from '@codemirror/commands'

interface Props {
  code: string
  readonly?: boolean
  language?: string
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  language: 'typescript',
})

const emit = defineEmits<{
  'update:code': [value: string]
  submit: []
}>()

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)

function getLanguageExtension(lang: string) {
  switch (lang.toLowerCase()) {
    case 'typescript':
    case 'ts':
      return javascript({ typescript: true })
    case 'javascript':
    case 'js':
      return javascript()
    case 'python':
    case 'py':
      return python()
    case 'rust':
    case 'rs':
      return rust()
    case 'go':
      return go()
    case 'vue':
      return vue()
    default:
      return javascript({ typescript: true })
  }
}

function createEditor() {
  if (!editorContainer.value) return

  const submitKeymap = keymap.of([
    {
      key: 'Ctrl-Enter',
      mac: 'Cmd-Enter',
      run: () => {
        emit('submit')
        return true
      },
    },
  ])

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      emit('update:code', update.state.doc.toString())
    }
  })

  const state = EditorState.create({
    doc: props.code,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      closeBrackets(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      submitKeymap,
      getLanguageExtension(props.language),
      oneDark,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      updateListener,
      EditorState.readOnly.of(props.readonly),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
        },
        '.cm-scroller': {
          fontFamily: 'var(--font-mono), monospace',
          overflow: 'auto',
        },
        '.cm-content': {
          padding: '16px 0',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          borderRight: '1px solid var(--color-border)',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          padding: '0 12px',
          minWidth: '40px',
        },
      }),
    ],
  })

  editorView.value = new EditorView({
    state,
    parent: editorContainer.value,
  })
}

function destroyEditor() {
  if (editorView.value) {
    editorView.value.destroy()
    editorView.value = null
  }
}

// Watch for external code changes
watch(
  () => props.code,
  (newCode) => {
    if (editorView.value) {
      const currentCode = editorView.value.state.doc.toString()
      if (newCode !== currentCode) {
        editorView.value.dispatch({
          changes: {
            from: 0,
            to: currentCode.length,
            insert: newCode,
          },
        })
      }
    }
  }
)

// Watch for language changes
watch(
  () => props.language,
  () => {
    destroyEditor()
    createEditor()
  }
)

onMounted(() => {
  createEditor()
})

onUnmounted(() => {
  destroyEditor()
})
</script>

<template>
  <div class="relative rounded-lg border border-border overflow-hidden h-full min-h-[300px]">
    <div ref="editorContainer" class="h-full" />
    <div class="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
      {{ language }} | Ctrl+Enter to submit
    </div>
  </div>
</template>

<style>
.cm-editor {
  height: 100%;
  background-color: var(--color-code-bg);
}

.cm-editor .cm-cursor {
  border-left-color: var(--color-foreground);
}

.cm-editor .cm-selectionBackground,
.cm-editor.cm-focused .cm-selectionBackground {
  background-color: var(--color-code-selection);
}
</style>
