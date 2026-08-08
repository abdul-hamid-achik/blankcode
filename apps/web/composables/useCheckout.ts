import { ref } from 'vue'
import { failureMessage } from '~/utils/http-error'
import { useAnalytics } from '~/composables/useAnalytics'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * Starts a Stripe Checkout session and sends the browser to it.
 *
 * Two places call this — the settings page's upgrade button and the pricing
 * section's — and both need the same three steps in the same order: POST,
 * count it, then leave. Two copies of that would drift the moment one of them
 * grew a retry or the analytics call moved before the request finished; one
 * composable is what keeps them identical on purpose rather than by review.
 */
export function useCheckout() {
  const busy = ref(false)
  const error = ref('')

  async function startCheckout(): Promise<void> {
    if (busy.value) return
    busy.value = true
    error.value = ''

    try {
      const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
      const { url, currency } = await $fetch<{ url: string; currency?: string | null }>(
        '/api/billing/checkout',
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )

      // Counted right before the redirect, not after: the browser is about to
      // leave this page, and a call placed after `window.location` is a call
      // that may never run. The currency is whatever the server actually
      // chose from the visitor's country — 'auto' when Adaptive Pricing
      // decides at Stripe — never a hardcoded guess.
      useAnalytics().emit('checkout-started', { currency: currency ?? 'auto' })
      window.location.href = url
    } catch (e) {
      error.value = failureMessage(e, 'Could not start checkout')
      busy.value = false
    }
  }

  return { busy, error, startCheckout }
}
