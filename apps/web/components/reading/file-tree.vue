<script setup lang="ts">
import { computed } from 'vue'

/**
 * The codebase as a list of files, with folders implied by the paths.
 *
 * No expand/collapse and no icons: four files do not need a widget, and the
 * thing worth showing instead is which ones you have actually opened. That tick
 * is the reader's own mark on the sheet — the only place the signal colour
 * belongs on this page — and it is what stops someone explaining three files
 * and forgetting the fourth exists.
 */

interface TreeFile {
  path: string
  content: string
}

const props = defineProps<{
  files: TreeFile[]
  activePath: string
  /** Paths already opened. Ticked, in the reader's own colour. */
  visited: string[]
  /** Horizontal chips instead of a column — the narrow-screen treatment. */
  chips?: boolean
}>()

const emit = defineEmits<{ select: [path: string] }>()

function baseName(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.slice(slash + 1)
}

function dirName(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

const groups = computed(() => {
  const byDir = new Map<string, TreeFile[]>()
  for (const file of props.files) {
    const dir = dirName(file.path)
    byDir.set(dir, [...(byDir.get(dir) ?? []), file])
  }
  return [...byDir.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([dir, files]) => ({ dir, files: files.toSorted((a, b) => a.path.localeCompare(b.path)) }))
})

function isVisited(path: string): boolean {
  return props.visited.includes(path)
}

function select(path: string): void {
  emit('select', path)
}
</script>

<template>
  <!-- Narrow screens: one scrollable row of chips. -->
  <div v-if="chips" class="-mx-4 overflow-x-auto px-4">
    <div class="flex w-max gap-2">
      <button
        v-for="file in files"
        :key="file.path"
        type="button"
        class="flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-xs transition-colors"
        :class="
          file.path === activePath
            ? 'border-rule-strong bg-muted text-foreground'
            : 'border-rule text-muted-foreground hover:text-foreground'
        "
        @click="select(file.path)"
      >
        <span v-if="isVisited(file.path)" class="text-signal" aria-hidden="true">&#10003;</span>
        {{ baseName(file.path) }}
      </button>
    </div>
  </div>

  <!-- Wide screens: a column, grouped by folder. -->
  <nav v-else aria-label="Files in this codebase">
    <div v-for="group in groups" :key="group.dir" class="mb-4 last:mb-0">
      <p class="eyebrow mb-1.5 truncate">{{ group.dir === '' ? 'root' : group.dir }}</p>
      <ul class="border-l border-rule">
        <li v-for="file in group.files" :key="file.path">
          <button
            type="button"
            class="flex w-full items-baseline gap-1.5 py-1 pl-3 pr-2 text-left font-mono text-xs transition-colors"
            :class="
              file.path === activePath
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="select(file.path)"
          >
            <span
              class="w-3 shrink-0"
              :class="isVisited(file.path) ? 'text-signal' : 'text-transparent'"
              aria-hidden="true"
              >&#10003;</span
            >
            <span class="truncate">{{ baseName(file.path) }}</span>
          </button>
        </li>
      </ul>
    </div>
  </nav>
</template>
