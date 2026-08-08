<script setup lang="ts">
import { go } from '@codemirror/lang-go'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { vue } from '@codemirror/lang-vue'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePreferencesStore } from '~/stores/preferences'
import { resolveEditorTheme } from '~/utils/editor-themes'

/**
 * A file, read-only, with real syntax highlighting.
 *
 * CodeMirror in its non-editor posture: `editable(false)` plus
 * `readOnly(true)` removes the cursor and every edit affordance, and the
 * grammars are the ones the exercise editor already ships — the reading page
 * looks like the writing page because it is the same product. The server
 * render is a plain numbered listing; the highlighted view replaces it after
 * hydration, so a crawler and a slow connection both still get the code.
 *
 * The README is the exception: it renders as prose-shaped mono text, not
 * through a grammar — it is the one file whose point is to be read as words.
 */

const props = defineProps<{
  path: string
  content: string
  language?: string
  /** Render as plain readable text (the fictional README). */
  plain?: boolean
  /** Show the expand control, and which direction it points. */
  expandable?: boolean
  expanded?: boolean
}>()

const emit = defineEmits<{ 'toggle-expand': [] }>()

const preferencesStore = usePreferencesStore()
const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null

const lines = computed(() => props.content.replace(/\n+$/, '').split('\n'))

function languageExtension(): Extension[] {
  switch (props.language) {
    case 'python':
      return [python()]
    case 'rust':
      return [rust()]
    case 'go':
      return [go()]
    case 'vue':
      return [vue()]
    case 'typescript':
    case 'javascript':
    case 'react':
      return [javascript({ typescript: true, jsx: true })]
    default:
      return []
  }
}

/** Mirrors the exercise editor's theme choice so the two surfaces agree. */
function themeExtension(): Extension[] {
  return [
    resolveEditorTheme(
      preferencesStore.preferences.editorTheme,
      preferencesStore.preferences.theme
    ),
  ]
}

function build() {
  if (!host.value || props.plain) return
  view?.destroy()
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.content.replace(/\n+$/, ''),
      extensions: [
        lineNumbers(),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.theme({
          '&': {
            fontSize: '0.75rem',
            backgroundColor: 'transparent',
            // Fullscreen: the editor fills its box and scrolls inside it;
            // inline it grows with the file and the page scrolls instead.
            ...(props.expanded ? { height: '100%' } : {}),
          },
          '.cm-scroller': {
            fontFamily: 'var(--font-mono)',
            lineHeight: '1.625',
            ...(props.expanded ? { overflow: 'auto' } : {}),
          },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            borderRight: '1px solid hsl(var(--rule))',
          },
        }),
        ...languageExtension(),
        ...themeExtension(),
      ],
    }),
  })
}

const hydrated = ref(false)

onMounted(() => {
  hydrated.value = true
  build()
})

onUnmounted(() => view?.destroy())

// A different file, a theme flip, or entering fullscreen rebuilds the view —
// cheaper than reconfiguration machinery for a read-only surface. The
// rebuild waits for the DOM: switching from the README (which renders the
// prose branch, no host div) to a code file mounts the host on THIS render
// pass, and building before nextTick found host=null and silently showed
// nothing — the "I clicked api.ts and nothing opened" bug.
watch(
  () => [
    props.path,
    props.content,
    props.plain,
    props.expanded,
    preferencesStore.preferences.theme,
    preferencesStore.preferences.editorTheme,
  ],
  async () => {
    if (!hydrated.value) return
    await nextTick()
    build()
  }
)
</script>

<template>
  <figure class="min-w-0 border border-rule" :class="{ 'flex h-full min-h-0 flex-col': expanded }">
    <figcaption
      class="flex items-baseline justify-between gap-3 border-b border-rule bg-muted/40 px-3 py-2"
    >
      <span class="truncate font-mono text-xs text-foreground">{{ path }}</span>
      <span class="flex shrink-0 items-baseline gap-3">
        <span class="font-mono text-xs text-muted-foreground">{{ lines.length }} lines</span>
        <button
          v-if="expandable"
          type="button"
          class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          :aria-label="expanded ? 'Exit full screen' : 'Read full screen'"
          @click="emit('toggle-expand')"
        >
          {{ expanded ? 'close ✕' : 'expand ⤢' }}
        </button>
      </span>
    </figcaption>

    <!-- The README reads as words; everything else reads as code. -->
    <div
      v-if="plain"
      class="whitespace-pre-wrap px-4 py-4 font-mono text-[0.8125rem] leading-relaxed"
      :class="{ 'min-h-0 flex-1 overflow-y-auto': expanded }"
    >
      {{ content }}
    </div>

    <template v-else>
      <div
        v-show="hydrated"
        ref="host"
        class="cm-reading min-w-0"
        :class="{ 'min-h-0 flex-1 overflow-hidden': expanded }"
      />
      <!-- Server render and pre-hydration fallback: numbered, unstyled, honest. -->
      <div v-if="!hydrated" class="flex overflow-x-auto">
        <pre
          class="shrink-0 select-none border-r border-rule px-2 py-3 text-right font-mono text-xs leading-relaxed text-muted-foreground"
          aria-hidden="true"
        ><code>{{ lines.map((_, index) => index + 1).join('\n') }}</code></pre>
        <pre
          class="min-w-0 px-3 py-3 font-mono text-xs leading-relaxed"
        ><code>{{ lines.join('\n') }}</code></pre>
      </div>
    </template>
  </figure>
</template>

<style scoped>
.cm-reading :deep(.cm-editor) {
  outline: none;
}
</style>
