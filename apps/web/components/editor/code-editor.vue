<script setup lang="ts">
import type { BlankRegionInStarter } from '@blankcode/shared'
import { closeBrackets } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { go } from '@codemirror/lang-go'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { vue } from '@codemirror/lang-vue'
import {
  bracketMatching,
  defaultHighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { Compartment, EditorState, type StateField } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  clearBlankFeedbackOnView,
  createBlankExtensions,
  setBlankFeedbackOnView,
} from '~/composables/useBlankEditor'
import { usePreferencesStore } from '~/stores/preferences'

interface Props {
  code: string
  readonly?: boolean
  language?: string
  blanks?: BlankRegionInStarter[]
  blankValues?: Map<string, string>
  blankFeedback?: Map<string, 'correct' | 'incorrect'>
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  language: 'typescript',
  blanks: () => [],
  blankValues: () => new Map(),
  blankFeedback: undefined,
})

const emit = defineEmits<{
  'update:code': [value: string]
  'update:blankValues': [values: Map<string, string>]
  submit: []
}>()

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)
let blankStateField: StateField<{
  values: Map<string, string>
  feedback: Map<string, 'correct' | 'incorrect'>
}> | null = null

const preferencesStore = usePreferencesStore()

const isBlankMode = computed(() => props.blanks.length > 0)

// Compartments for reconfigurable extensions
const fontSizeCompartment = new Compartment()
const tabSizeCompartment = new Compartment()
const wordWrapCompartment = new Compartment()

// Computed preferences
const fontSize = computed(() => preferencesStore.preferences.fontSize)
const tabSize = computed(() => preferencesStore.preferences.tabSize)
const wordWrap = computed(() => preferencesStore.preferences.wordWrap)

function getFontSizeExtension(size: number) {
  return EditorView.theme({
    '&': {
      fontSize: `${size}px`,
    },
  })
}

function getTabSizeExtension(size: number) {
  return [indentUnit.of(' '.repeat(size)), EditorState.tabSize.of(size)]
}

function getWordWrapExtension(enabled: boolean) {
  return enabled ? EditorView.lineWrapping : []
}

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

  // Build blank extensions if in blank mode
  let blankExtensions: ReturnType<typeof createBlankExtensions> | null = null
  if (isBlankMode.value) {
    blankExtensions = createBlankExtensions({
      blanks: props.blanks,
      initialValues: props.blankValues,
      onValuesChange: (values) => {
        emit('update:blankValues', values)
      },
      onSubmit: () => {
        emit('submit')
      },
    })
    blankStateField = blankExtensions.stateField
  } else {
    blankStateField = null
  }

  const state = EditorState.create({
    doc: props.code,
    extensions: [
      lineNumbers(),
      // Only show active line highlighting in non-blank mode
      ...(isBlankMode.value ? [] : [highlightActiveLine(), highlightActiveLineGutter()]),
      bracketMatching(),
      closeBrackets(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      submitKeymap,
      getLanguageExtension(props.language),
      oneDark,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      // In blank mode: read-only + blank extensions; otherwise: normal editing
      ...(isBlankMode.value && blankExtensions
        ? [EditorState.readOnly.of(true), ...blankExtensions.extensions]
        : [updateListener, EditorState.readOnly.of(props.readonly)]),
      // Compartments for reconfigurable settings
      fontSizeCompartment.of(getFontSizeExtension(fontSize.value)),
      tabSizeCompartment.of(getTabSizeExtension(tabSize.value)),
      wordWrapCompartment.of(getWordWrapExtension(wordWrap.value)),
      EditorView.theme({
        '&': {
          height: '100%',
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

// Rebuild editor when blanks change (e.g., exercise loaded asynchronously)
watch(
  () => props.blanks,
  () => {
    destroyEditor()
    createEditor()
  }
)

// Watch for feedback changes and dispatch effects
watch(
  () => props.blankFeedback,
  (feedback) => {
    if (editorView.value && blankStateField && feedback) {
      setBlankFeedbackOnView(editorView.value, feedback, blankStateField)
    } else if (editorView.value && blankStateField && !feedback) {
      clearBlankFeedbackOnView(editorView.value, blankStateField)
    }
  }
)

// Watch for preference changes and reconfigure editor
watch(fontSize, (newSize) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: fontSizeCompartment.reconfigure(getFontSizeExtension(newSize)),
    })
  }
})

watch(tabSize, (newSize) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: tabSizeCompartment.reconfigure(getTabSizeExtension(newSize)),
    })
  }
})

watch(wordWrap, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: wordWrapCompartment.reconfigure(getWordWrapExtension(enabled)),
    })
  }
})

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
      {{ language }}{{ isBlankMode ? ' | Tab to navigate' : '' }} | Ctrl+Enter to submit
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
