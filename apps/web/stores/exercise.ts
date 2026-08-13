import type { BlankRegionInStarter, Exercise, RunOutcome, Submission } from '@blankcode/shared'
import { defineStore } from 'pinia'
import { useAnalytics } from '~/composables/useAnalytics'
import { extractDraftBlankValues, reconstructCode } from '~/composables/useBlankEditor'

export const useExerciseStore = defineStore('exercise', () => {
  const exercise = ref<Exercise | null>(null)
  const submissions = ref<Submission[]>([])
  const currentCode = ref('')
  const codeSource = ref<'draft' | 'submission' | 'starter'>('starter')
  const blanks = ref<BlankRegionInStarter[]>([])
  const blankValues = ref<Map<string, string>>(new Map())
  const blankFeedback = ref<Map<string, 'correct' | 'incorrect'> | undefined>(undefined)
  const isSubmitting = ref(false)
  const latestSubmission = ref<Submission | null>(null)
  /**
   * Submissions this sitting created (or retried). loadSubmissions hydrates
   * last week's pass on every due review; that id must not join this set,
   * or opening the item looks like we just passed it again.
   */
  const sittingSubmissionIds = ref<string[]>([])
  // The iterate step: a run executes but records nothing, so its result lives
  // apart from submissions and is cleared the moment a real one starts.
  const isRunning = ref(false)
  const latestRun = ref<RunOutcome | null>(null)
  const runError = ref<string | null>(null)
  const isSaving = ref(false)
  const timedOut = ref(false)
  const submissionError = ref<string | null>(null)
  const loadError = ref<string | null>(null)
  let pollInterval: ReturnType<typeof setInterval> | null = null
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let pollStartTime = 0
  const POLL_TIMEOUT_MS = 90000

  const hasPassedSubmission = computed(() => submissions.value.some((s) => s.status === 'passed'))
  const isBlankMode = computed(() => exercise.value?.type === 'blank' && blanks.value.length > 0)
  const isChallengeMode = computed(() => exercise.value?.type === 'challenge')
  /*
   * A review starts from code that already looks finished and is wrong.
   * Without saying so, the editor is indistinguishable from a challenge's
   * stub — and a learner who thinks they are completing something will never
   * go looking for the defect.
   */
  const isReviewMode = computed(() => exercise.value?.type === 'review')

  /**
   * What CodeMirror renders.
   *
   * In blank mode this must be the untouched starter code: the blank offsets
   * (`from`/`to`) index into the starter, and the widgets carry the user's
   * values separately. Feeding the *reconstructed* code in — as happened when
   * a draft was restored — shifts every offset after the first answer whose
   * length differs from its placeholder, so widgets land on the wrong
   * characters and eventually a decoration spans a newline, which CodeMirror
   * rejects with "Decorations that replace line breaks may not be specified
   * via plugins" and the editor dies.
   */
  const editorCode = computed(() =>
    isBlankMode.value ? (exercise.value?.starterCode ?? '') : currentCode.value
  )
  const filledBlanksCount = computed(() => {
    let count = 0
    for (const [, value] of blankValues.value) {
      if (value.trim().length > 0) count++
    }
    return count
  })

  async function fetchExerciseData(exerciseId: string) {
    const api = useApi()
    try {
      const progress = await api.exercises.getWithProgress(exerciseId)
      exercise.value = progress.exercise
      currentCode.value = progress.code
      codeSource.value = progress.codeSource
      return true
    } catch {
      // Fall back to basic exercise fetch (unauthenticated)
    }
    try {
      exercise.value = await api.exercises.getById(exerciseId)
      currentCode.value = exercise.value?.starterCode ?? ''
      return true
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : 'Failed to load exercise'
      return false
    }
  }

  async function loadExercise(exerciseId: string) {
    loadError.value = null
    if (!(await fetchExerciseData(exerciseId))) return

    // Populate blank state from exercise data
    if (exercise.value?.blanks?.length) {
      blanks.value = exercise.value.blanks

      // If we have a draft or submission, extract blank values from the saved
      // code — via the draft variant, which drops the placeholders that
      // reconstruction wrote for untouched blanks.
      if (codeSource.value !== 'starter' && currentCode.value !== exercise.value.starterCode) {
        blankValues.value = extractDraftBlankValues(
          currentCode.value,
          exercise.value.starterCode,
          blanks.value
        )
      } else {
        blankValues.value = new Map()
      }
    }

    await loadSubmissions(exerciseId)
  }

  async function loadSubmissions(exerciseId: string) {
    const api = useApi()
    submissions.value = await api.submissions.getByExercise(exerciseId)
    latestSubmission.value = submissions.value[0] ?? null
  }

  function handlePollTimeout() {
    timedOut.value = true
    stopPolling()
    isSubmitting.value = false
  }

  function handleSubmissionComplete() {
    timedOut.value = false
    stopPolling()
    isSubmitting.value = false
    if (isBlankMode.value) {
      computeBlankFeedback()
    }

    // The chart that matters: which exercises pass and which eat people.
    // Slugs only — low cardinality, nobody identified.
    const status = latestSubmission.value?.status
    const doc = exercise.value as
      | (typeof exercise.value & { concept?: { track?: { slug?: string } } })
      | null
    if (doc && (status === 'passed' || status === 'failed')) {
      useAnalytics().emit('submission-graded', {
        track: doc.concept?.track?.slug ?? 'unknown',
        exercise: doc.slug,
        passed: status === 'passed',
      })
    }
  }

  async function pollSubmissionStatus(submissionId: string) {
    stopPolling()
    timedOut.value = false
    pollStartTime = Date.now()

    pollInterval = setInterval(async () => {
      const api = useApi()
      const isTimedOut = Date.now() - pollStartTime >= POLL_TIMEOUT_MS
      try {
        if (isTimedOut) {
          handlePollTimeout()
          return
        }

        const updated = await api.submissions.getById(submissionId)
        latestSubmission.value = updated

        const idx = submissions.value.findIndex((s) => s.id === submissionId)
        if (idx >= 0) {
          submissions.value[idx] = updated
        }

        if (updated.status !== 'pending' && updated.status !== 'running') {
          handleSubmissionComplete()
        }
      } catch {
        // Don't give up on transient errors (429, network blips) — just skip this tick
        if (isTimedOut) {
          handlePollTimeout()
        }
      }
    }, 2000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  function stopAutosave() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
  }

  async function saveDraft(code: string) {
    if (!exercise.value) return
    const api = useApi()
    isSaving.value = true
    try {
      await api.exercises.saveDraft(exercise.value.id, code)
      codeSource.value = 'draft'
    } catch (_error) {
      // Don't throw - draft save failure shouldn't block the user
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Synchronously fire the draft save before the page goes away.
   * sendBeacon survives 'beforeunload'; the regular fetch in saveDraft does not.
   * The pending debounce timer is cleared so it doesn't fire after navigation.
   */
  function flushDraftOnUnload() {
    if (!autosaveTimer || !exercise.value) return
    stopAutosave()
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return
    const tokenCookie = useCookie<string | null>('token')
    const token = tokenCookie.value
    if (!token) return
    const {
      public: { apiUrl },
    } = useRuntimeConfig()
    const blob = new Blob([JSON.stringify({ code: currentCode.value, _token: token })], {
      type: 'application/json',
    })
    // The API expects a Bearer header; sendBeacon can't set custom headers.
    // We fall back to a keepalive fetch so auth headers go through.
    try {
      navigator.sendBeacon(`${apiUrl}/exercises/${exercise.value.id}/draft`, blob)
    } catch {
      // ignore
    }
    try {
      fetch(`${apiUrl}/exercises/${exercise.value.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: currentCode.value }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // ignore
    }
  }

  function updateCode(code: string) {
    currentCode.value = code
    stopAutosave()
    autosaveTimer = setTimeout(() => saveDraft(code), 10000)
  }

  function updateBlankValues(values: Map<string, string>) {
    blankValues.value = values
    blankFeedback.value = undefined

    // Reconstruct full code from blank values for autosave
    if (exercise.value && blanks.value.length > 0) {
      const code = reconstructCode(exercise.value.starterCode, blanks.value, values)
      currentCode.value = code
      stopAutosave()
      autosaveTimer = setTimeout(() => saveDraft(code), 10000)
    }
  }

  /**
   * Reads the per-blank verdict the API attached to the finished submission.
   *
   * This used to be computed here by comparing against `blank.solution`, which
   * forced the API to ship every answer to the browser — the solution to any
   * exercise was one Network tab away. Grading now happens server-side and the
   * client only renders the result.
   */
  function computeBlankFeedback() {
    const verdicts = (latestSubmission.value as { blankFeedback?: Record<string, string> } | null)
      ?.blankFeedback
    if (!verdicts) {
      blankFeedback.value = undefined
      return
    }

    const feedback = new Map<string, 'correct' | 'incorrect'>()
    for (const blank of blanks.value) {
      const verdict = verdicts[blank.id]
      if (verdict === 'correct' || verdict === 'incorrect') feedback.set(blank.id, verdict)
    }
    blankFeedback.value = feedback
  }

  /**
   * Executes the current code against the real suite without creating a
   * submission — feedback, not a verdict. Nothing lands on progress or the
   * review schedule; the pass that counts still comes from submitCode.
   */
  async function runCode(code?: string) {
    if (!exercise.value) return
    if (isRunning.value || isSubmitting.value) return

    const codeToRun = isBlankMode.value
      ? reconstructCode(exercise.value.starterCode, blanks.value, blankValues.value)
      : (code ?? currentCode.value)

    const api = useApi()
    runError.value = null
    isRunning.value = true
    try {
      latestRun.value = await api.submissions.run({
        exerciseId: exercise.value.id,
        code: codeToRun,
      })
      useAnalytics().emit('practice-run', { status: latestRun.value.status })
    } catch (e) {
      runError.value = e instanceof Error ? e.message : 'Run failed'
      if (/limit|429|free runs/i.test(runError.value)) {
        useAnalytics().emit('limit-reached', { kind: 'run' })
      }
    } finally {
      isRunning.value = false
    }
  }

  async function submitCode(code?: string) {
    if (!exercise.value) return
    if (isSubmitting.value) return

    // In blank mode, reconstruct the code from blank values
    const submitCode = isBlankMode.value
      ? reconstructCode(exercise.value.starterCode, blanks.value, blankValues.value)
      : (code ?? currentCode.value)

    const api = useApi()
    submissionError.value = null
    // The run was a draft of this moment; the submission supersedes it.
    latestRun.value = null
    runError.value = null
    isSubmitting.value = true
    stopAutosave()
    try {
      const submission = await api.submissions.create({
        exerciseId: exercise.value.id,
        code: submitCode,
      })
      if (!sittingSubmissionIds.value.includes(submission.id)) {
        sittingSubmissionIds.value = [...sittingSubmissionIds.value, submission.id]
      }
      latestSubmission.value = submission
      submissions.value = [submission, ...submissions.value]

      await api.exercises.deleteDraft(exercise.value.id)
      codeSource.value = 'submission'

      pollSubmissionStatus(submission.id)

      return submission
    } catch (e) {
      isSubmitting.value = false
      submissionError.value = e instanceof Error ? e.message : 'Submission failed'
      // The cap doing its work is a signal, not an error to hide.
      if (/limit|429/i.test(submissionError.value)) {
        useAnalytics().emit('limit-reached', { kind: 'submission' })
      }
    }
  }

  async function retrySubmission(submissionId: string) {
    const api = useApi()
    timedOut.value = false
    if (!sittingSubmissionIds.value.includes(submissionId)) {
      sittingSubmissionIds.value = [...sittingSubmissionIds.value, submissionId]
    }
    await api.submissions.retry(submissionId)
    pollSubmissionStatus(submissionId)
  }

  function reset() {
    stopPolling()
    stopAutosave()
    exercise.value = null
    submissions.value = []
    currentCode.value = ''
    blanks.value = []
    blankValues.value = new Map()
    blankFeedback.value = undefined
    codeSource.value = 'starter'
    isSubmitting.value = false
    isSaving.value = false
    latestSubmission.value = null
    sittingSubmissionIds.value = []
    isRunning.value = false
    latestRun.value = null
    runError.value = null
    timedOut.value = false
    submissionError.value = null
    loadError.value = null
  }

  return {
    exercise,
    submissions,
    currentCode,
    editorCode,
    codeSource,
    blanks,
    blankValues,
    blankFeedback,
    isBlankMode,
    isChallengeMode,
    isReviewMode,
    filledBlanksCount,
    isSubmitting,
    isSaving,
    latestSubmission,
    sittingSubmissionIds,
    isRunning,
    latestRun,
    runError,
    timedOut,
    submissionError,
    loadError,
    hasPassedSubmission,
    loadExercise,
    loadSubmissions,
    runCode,
    submitCode,
    retrySubmission,
    updateCode,
    updateBlankValues,
    computeBlankFeedback,
    reset,
    stopPolling,
    stopAutosave,
    flushDraftOnUnload,
  }
})
