/**
 * What the server said, not what ofetch made of it.
 *
 * A FetchError's `statusMessage` aliases `response.statusText`, which is
 * empty over HTTP/2 on Vercel; the sentence written for the reader lives in
 * `data.statusMessage`. Reading the wrong one is how "No subscription to
 * manage yet" becomes an invisible '' and a button that silently does
 * nothing — which is exactly what the review caught on the billing pair
 * while three sibling files carried a correct private copy of this helper.
 * One copy now, and its `statusCode` reader beside it.
 */
export function failureMessage(caught: unknown, fallback: string): string {
  const failure = caught as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
    message?: string
  }
  return failure.data?.statusMessage ?? failure.data?.message ?? failure.statusMessage ?? fallback
}

export function failureStatus(caught: unknown): number | null {
  const failure = caught as { statusCode?: number; response?: { status?: number } }
  return failure.statusCode ?? failure.response?.status ?? null
}
