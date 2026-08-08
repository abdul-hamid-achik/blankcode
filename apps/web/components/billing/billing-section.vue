<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { useCheckout } from '~/composables/useCheckout'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'
import { failureMessage } from '~/utils/http-error'

/**
 * The "Plan" card on /settings.
 *
 * Reads `/api/billing/status` for the truth (`hasPaidAccess`, not a guess),
 * and shares its checkout call with the pricing page through `useCheckout` so
 * the two cannot answer "what does upgrading do" differently. The portal call
 * is local — only one place on the site opens it.
 */

interface BillingStatus {
  paid: boolean
  status: string | null
  endsAt: string | null
}

const route = useRoute()

function authHeaders(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const status = ref<BillingStatus | null>(null)

async function loadStatus() {
  try {
    status.value = await $fetch<BillingStatus>('/api/billing/status', { headers: authHeaders() })
  } catch {
    // Renders as free — the safe reading when the check itself failed.
    status.value = null
  }
}

const { busy: checkoutBusy, error: checkoutError, startCheckout } = useCheckout()

const portalBusy = ref(false)
const portalError = ref('')

async function openPortal() {
  if (portalBusy.value) return
  portalBusy.value = true
  portalError.value = ''
  try {
    const { url } = await $fetch<{ url: string }>('/api/billing/portal', {
      method: 'POST',
      headers: authHeaders(),
    })
    window.location.href = url
  } catch (e) {
    portalError.value = failureMessage(e, 'Could not open the billing portal')
    portalBusy.value = false
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Only shown when the plain "Pro" line would otherwise omit something true. */
const planStatusLine = computed(() => {
  if (!status.value) return null
  const { status: subscriptionStatus, endsAt } = status.value
  if (subscriptionStatus === 'past_due') return 'Payment past due — Stripe is retrying the card.'
  if (subscriptionStatus === 'trialing') return 'Trial — becomes a paid subscription automatically.'
  if (endsAt && subscriptionStatus !== 'active')
    return `Cancelled — active until ${formatDate(endsAt)}.`
  return null
})

// Webhooks land after the redirect, sometimes by a couple of seconds, so the
// first read here can still show "Free" even though the payment went through.
// One retry covers the ordinary lag without polling forever.
const checkoutResult =
  route.query['checkout'] === 'done'
    ? 'done'
    : route.query['checkout'] === 'cancelled'
      ? 'cancelled'
      : null

onMounted(async () => {
  await loadStatus()
  if (checkoutResult === 'done') {
    setTimeout(loadStatus, 2000)
  }
})
</script>

<template>
  <Card>
    <h2 class="display text-lg mb-1">Plan</h2>

    <p v-if="checkoutResult === 'done'" class="text-xs text-pass mb-4">
      Payment received — Pro is active.
    </p>
    <p v-else-if="checkoutResult === 'cancelled'" class="text-xs text-muted-foreground mb-4">
      Checkout cancelled. Nothing changed.
    </p>

    <div v-if="status?.paid">
      <p class="text-sm mb-1">Pro — unlimited submissions and explanations.</p>
      <p v-if="planStatusLine" class="text-xs text-muted-foreground mb-4">{{ planStatusLine }}</p>
      <Button variant="outline" size="sm" :loading="portalBusy" @click="openPortal">
        Manage subscription
      </Button>
      <p v-if="portalError" class="text-xs text-fail mt-2">{{ portalError }}</p>
    </div>
    <div v-else>
      <p class="text-sm mb-4">Free — 10 submissions and 3 AI explanations a day.</p>
      <Button size="sm" :loading="checkoutBusy" @click="startCheckout">
        Upgrade — $12/month
      </Button>
      <p class="font-mono text-xs text-muted-foreground mt-2">
        219 MXN &middot; 11 EUR &middot; billed by Stripe
      </p>
      <p v-if="checkoutError" class="text-xs text-fail mt-2">{{ checkoutError }}</p>
    </div>
  </Card>
</template>
