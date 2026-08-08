<script setup lang="ts">
import { computed } from 'vue'

/**
 * A file, read-only, with numbered lines.
 *
 * No editor. There is nothing to type here, and a CodeMirror instance would
 * bring a cursor, a selection model and an edit affordance to a page whose
 * whole claim is that you are reading rather than writing. The line numbers are
 * the one thing worth adding: they are how a reader cites what they found when
 * they come to write the explanation.
 */

const props = defineProps<{
  path: string
  content: string
}>()

const lines = computed(() => props.content.replace(/\n+$/, '').split('\n'))
</script>

<template>
  <figure class="min-w-0 border border-rule">
    <figcaption
      class="flex items-baseline justify-between gap-3 border-b border-rule bg-muted/40 px-3 py-2"
    >
      <span class="truncate font-mono text-xs text-foreground">{{ path }}</span>
      <span class="shrink-0 font-mono text-xs text-muted-foreground">{{ lines.length }} lines</span>
    </figcaption>

    <div class="flex overflow-x-auto">
      <pre
        class="shrink-0 select-none border-r border-rule px-2 py-3 text-right font-mono text-xs leading-relaxed text-muted-foreground"
        aria-hidden="true"
      ><code>{{ lines.map((_, index) => index + 1).join('\n') }}</code></pre>
      <pre
        class="min-w-0 px-3 py-3 font-mono text-xs leading-relaxed"
      ><code>{{ lines.join('\n') }}</code></pre>
    </div>
  </figure>
</template>
