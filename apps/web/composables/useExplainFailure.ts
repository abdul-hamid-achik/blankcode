import { ref } from 'vue'

/**
 * Streams an explanation of why a submission failed.
 *
 * Streamed rather than awaited whole because the first sentence usually
 * contains the answer, and a learner who is stuck should not sit in front of a
 * spinner for it.
 *
 * Deliberately opt-in. The failure itself is the retrieval attempt — that is
 * what the whole product is built on — so reading an explanation has to be a
 * decision, not something that happens to you the moment you are wrong.
 */
export function useExplainFailure() {
  const explanation = ref('')
  const streaming = ref(false)
  const error = ref<string | null>(null)

  async function explain(submissionId: string): Promise<void> {
    if (streaming.value) return

    explanation.value = ''
    error.value = null
    streaming.value = true

    try {
      // Same cookie `useApi` reads, so this cannot drift from the rest of the app.
      const token = useCookie<string | null>('token').value
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ submissionId }),
      })

      if (!response.ok) {
        // The endpoint's own statuses carry meaning worth passing on: 429 is a
        // budget, 503 is "not configured", and neither is a bug to report.
        error.value =
          response.status === 429
            ? 'You have used this a lot in the last hour. Try again later.'
            : response.status === 503
              ? 'Explanations are not available right now.'
              : 'Could not explain this one.'
        return
      }

      const body = response.body
      if (!body) {
        error.value = 'Could not explain this one.'
        return
      }

      const reader = body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        explanation.value += decoder.decode(value, { stream: true })
      }
    } catch {
      error.value = 'Could not explain this one.'
    } finally {
      streaming.value = false
    }
  }

  function reset(): void {
    explanation.value = ''
    error.value = null
  }

  return { explanation, streaming, error, explain, reset }
}
