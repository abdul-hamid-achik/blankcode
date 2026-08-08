<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import CodeView from '~/components/reading/code-view.vue'
import FileTree from '~/components/reading/file-tree.vue'
import RubricLedger from '~/components/reading/rubric-ledger.vue'
import Button from '~/components/ui/button.vue'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * One reading exercise: the tree, the file, and the box you write in.
 *
 * The layout is deliberately not an IDE. Files on the left, one file at a time
 * in the middle, and the explanation underneath the code rather than beside it
 * — writing about a codebase is a different posture from scanning it, and a
 * three-column screen invites you to do neither properly.
 *
 * Nothing here knows the rubric. The server holds it until the attempt is
 * spent, which is why the ledger arrives with the grade rather than being
 * filtered into view.
 */

definePageMeta({ requiresAuth: true, middleware: 'auth' })

interface ReadingFile {
  path: string
  content: string
}

interface Attempt {
  id: string
  score: number
  maxScore: number
  createdAt: string
}

interface Quota {
  paid: boolean
  dailyLimit: number | null
  remainingToday: number | null
}

interface Detail {
  exercise: {
    id: string
    slug: string
    title: string
    brief: string
    language: string
    difficulty: string
    files: ReadingFile[]
  }
  attempts: Attempt[]
  quota: Quota | null
}

interface RubricResult {
  id: string
  point: string
  weight: number
  hit: boolean
  note: string
}

interface Grade {
  score: number
  maxScore: number
  rubricResults: RubricResult[]
  attempts: number
  bestScore: number
  quota: Quota
}

const route = useRoute()
const slug = computed(() => route.params['slug'] as string)

function headers(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const { data } = await useAsyncData(`reading-${slug.value}`, () =>
  $fetch<Detail>(`/api/reading/${slug.value}`, { headers: headers() }).catch(() => null)
)

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Reading exercise not found', fatal: true })
}

const exercise = computed(() => data.value?.exercise)
const files = computed<ReadingFile[]>(() => exercise.value?.files ?? [])

/**
 * The brief lives where a brief lives in a real repo: a README at the top of
 * the tree, open by default. The page header carries only the title and the
 * mono meta — the instructions ARE part of the codebase you are reading.
 */
const README_PATH = 'README.md'

const readme = computed(() => {
  const doc = exercise.value
  if (!doc) return ''
  return [
    `# ${doc.title}`,
    '',
    doc.brief,
    '',
    `— ${doc.language} · ${doc.difficulty} · ${files.value.length} files · graded against a hidden rubric`,
  ].join('\n')
})

const allFiles = computed<ReadingFile[]>(() => [
  { path: README_PATH, content: readme.value },
  ...files.value,
])

const activePath = ref(README_PATH)
const visited = ref<string[]>([README_PATH])
const activeFile = computed(() => allFiles.value.find((file) => file.path === activePath.value))

function openFile(path: string): void {
  activePath.value = path
  if (!visited.value.includes(path)) visited.value = [...visited.value, path]
}

const unopened = computed(() => files.value.filter((file) => !visited.value.includes(file.path)))

/**
 * Full screen is a real mode, not a bigger box: the tree and the file take
 * the viewport, everything else waits. Esc leaves.
 */
const expanded = ref(false)

// The page behind the overlay must not scroll — that was the bug: wheel
// events fell through and moved the document while the reader thought they
// were scrolling code.
watch(expanded, (isExpanded) => {
  if (!import.meta.client) return
  document.documentElement.style.overflow = isExpanded ? 'hidden' : ''
})

onUnmounted(() => {
  if (import.meta.client) document.documentElement.style.overflow = ''
})

function onWorkspaceKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && expanded.value) expanded.value = false
}

const analytics = useAnalytics()

onMounted(() => {
  window.addEventListener('keydown', onWorkspaceKeydown)
  analytics.emit('reading-opened', { reading: slug.value })
})
onUnmounted(() => window.removeEventListener('keydown', onWorkspaceKeydown))

const explanation = ref('')
const submitting = ref(false)
const error = ref('')
const grade = ref<Grade | null>(null)
const attempts = ref<Attempt[]>(data.value?.attempts ?? [])
const quota = ref<Quota | null>(data.value?.quota ?? null)

const MIN_CHARS = 120
const written = computed(() => explanation.value.trim().length)
const longEnough = computed(() => written.value >= MIN_CHARS)

/** What is left, said plainly, before the button is pressed rather than after. */
const quotaLine = computed(() => {
  const current = quota.value
  if (!current || current.dailyLimit === null) return 'No daily cap on grading for your plan.'
  if (current.remainingToday === null) {
    return `The free plan grades ${current.dailyLimit} readings a day.`
  }
  if (current.remainingToday === 0) {
    return `The free plan grades ${current.dailyLimit} readings a day, and this day is spent.`
  }
  return `${current.remainingToday} of ${current.dailyLimit} graded readings left today.`
})

const outOfGrades = computed(() => quota.value?.remainingToday === 0)

/**
 * What the server said, not what ofetch made of it.
 *
 * A FetchError's `message` is the method, the URL and the status glued
 * together; the sentence written for the reader is in the body. Showing the
 * wrapper instead is how "try again" becomes "[POST] /api/…: 502".
 */
function failureMessage(caught: unknown): string {
  const failure = caught as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
  }
  return (
    failure.data?.statusMessage ??
    failure.data?.message ??
    failure.statusMessage ??
    'The grade did not come back. Nothing was recorded — try again.'
  )
}

async function submit(): Promise<void> {
  if (submitting.value || !longEnough.value) return
  submitting.value = true
  error.value = ''

  try {
    const result = await $fetch<Grade>(`/api/reading/${slug.value}/submit`, {
      method: 'POST',
      headers: headers(),
      body: { explanation: explanation.value },
    })
    grade.value = result
    quota.value = result.quota
    // Five buckets, not raw scores — enough for the curve, nothing per-person.
    analytics.emit('reading-graded', {
      reading: slug.value,
      band: (Math.round((result.score / Math.max(1, result.maxScore)) * 4) * 25) as
        | 0
        | 25
        | 50
        | 75
        | 100,
    })
    attempts.value = [
      {
        id: `attempt-${result.attempts}`,
        score: result.score,
        maxScore: result.maxScore,
        createdAt: new Date().toISOString(),
      },
      ...attempts.value,
    ]
  } catch (caught) {
    error.value = failureMessage(caught)
    if (/limit|a day|429/i.test(error.value)) {
      analytics.emit('limit-reached', { kind: 'reading' })
    }
  } finally {
    submitting.value = false
  }
}

/** Back to the code with the ledger still in mind, and a blank box. */
function readAgain(): void {
  grade.value = null
  explanation.value = ''
  if (files.value[0]) openFile(files.value[0].path)
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function attemptDate(iso: string): string {
  return iso.slice(0, 10)
}

useSeoMeta({
  title: () => `${exercise.value?.title ?? 'Reading'} — BlankCode`,
  description: () => exercise.value?.brief ?? '',
})
</script>

<template>
  <div v-if="exercise" class="container max-w-5xl py-8 md:py-12">
    <p class="eyebrow mb-2">reading</p>
    <h1 class="display text-xl md:text-2xl mb-2">{{ exercise.title }}</h1>
    <p class="mb-6 font-mono text-xs text-muted-foreground">
      {{ exercise.language }} · {{ exercise.difficulty }} · {{ files.length }} files · the brief is
      in the README
    </p>

    <!-- The codebase. Tree beside the file on wide screens, chips above it
         otherwise; expanded, the workspace takes the whole viewport. -->
    <div
      class="grid gap-6"
      :class="
        expanded
          ? 'fixed inset-0 z-50 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden bg-background p-4 md:p-6 lg:grid-cols-[14rem_minmax(0,1fr)]'
          : 'lg:grid-cols-[12rem_minmax(0,1fr)]'
      "
    >
      <aside class="hidden lg:block" :class="{ 'min-h-0 overflow-y-auto': expanded }">
        <FileTree
          :files="allFiles"
          :active-path="activePath"
          :visited="visited"
          @select="openFile"
        />
      </aside>

      <div class="min-w-0" :class="{ 'flex min-h-0 flex-col': expanded }">
        <FileTree
          class="mb-4 lg:hidden"
          :class="{ 'shrink-0': expanded }"
          chips
          :files="allFiles"
          :active-path="activePath"
          :visited="visited"
          @select="openFile"
        />
        <CodeView
          v-if="activeFile"
          :path="activeFile.path"
          :content="activeFile.content"
          :language="exercise.language"
          :plain="activeFile.path === README_PATH"
          expandable
          :expanded="expanded"
          @toggle-expand="expanded = !expanded"
        />
      </div>
    </div>

    <!-- The attempt. -->
    <section v-if="!grade" class="mt-10 max-w-2xl">
      <p class="eyebrow mb-2">your reading</p>
      <p class="mb-4 leading-relaxed">
        Explain what this does. The more precisely you cover what actually happens, the higher the
        score. Vague credit is not given.
      </p>

      <label for="explanation" class="sr-only">Your explanation</label>
      <textarea
        id="explanation"
        v-model="explanation"
        rows="12"
        class="w-full resize-y rounded border border-rule bg-background px-3 py-2.5 text-sm leading-relaxed"
        placeholder="What each file is for, how they are wired together, and what actually happens when it runs."
      />

      <div class="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p class="font-mono text-xs text-muted-foreground">
          {{ written }} characters<template v-if="!longEnough"> · {{ MIN_CHARS }} minimum</template>
        </p>
        <p class="font-mono text-xs text-muted-foreground">{{ quotaLine }}</p>
      </div>

      <p v-if="unopened.length > 0" class="mt-2 font-mono text-xs text-muted-foreground">
        {{ unopened.length }} {{ unopened.length === 1 ? 'file' : 'files' }} still unopened:
        {{ unopened.map((file) => file.path).join(', ') }}
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <Button :disabled="submitting || !longEnough || outOfGrades" @click="submit">
          {{ submitting ? 'Grading…' : 'Grade this reading' }}
        </Button>
        <p v-if="submitting" class="font-mono text-xs text-muted-foreground">
          The grader is reading both the codebase and your explanation.
        </p>
      </div>

      <p v-if="error" class="mt-3 text-sm text-fail">{{ error }}</p>
    </section>

    <!-- The grade. -->
    <section v-else class="mt-10 max-w-2xl">
      <RubricLedger
        :results="grade.rubricResults"
        :score="grade.score"
        :max-score="grade.maxScore"
      />

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <Button @click="readAgain">Read it again, then try once more</Button>
        <NuxtLink
          to="/reading"
          class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          back to the list &#8594;
        </NuxtLink>
      </div>
      <p class="mt-3 font-mono text-xs text-muted-foreground">{{ quotaLine }}</p>
    </section>

    <!-- Everything you have said about this codebase before. -->
    <section v-if="attempts.length > 0" class="mt-10 max-w-2xl">
      <p class="eyebrow mb-3">your attempts</p>
      <ol class="border border-rule">
        <li
          v-for="attempt in attempts"
          :key="attempt.id"
          class="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2.5 last:border-b-0"
        >
          <span class="font-mono text-xs text-muted-foreground">{{
            attemptDate(attempt.createdAt)
          }}</span>
          <span
            class="font-mono text-xs"
            :class="attempt.score === attempt.maxScore ? 'text-pass' : 'text-foreground'"
            >{{ attempt.score }}/{{ attempt.maxScore }}</span
          >
        </li>
      </ol>
    </section>
  </div>
</template>
