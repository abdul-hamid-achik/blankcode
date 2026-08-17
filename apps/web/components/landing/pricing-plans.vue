<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from '~/components/ui/button.vue'
import { useCheckout } from '~/composables/useCheckout'
import { useAuthStore } from '~/stores/auth'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * The pricing section, mounted on the landing page.
 *
 * The numbers were computed, not chosen: a submission costs ~$0.00082 (one
 * vCPU, and provisioned memory billed with a one-minute minimum is most of it),
 * so ten a day puts a maxed-out free account at about $0.25 a month. Stripe in
 * Mexico takes 3.6% + MXN 3.00, +0.5% on international cards, +0.7% for
 * Billing, all before IVA — which is why the paid tier is 12 and not 10.
 *
 * Three currencies are shown because the Stripe price carries an exact amount
 * for each. Everywhere else Adaptive Pricing converts at checkout, so what a
 * visitor in Ankara pays is close to the USD figure rather than any of these.
 *
 * The CTA depends on who is looking: signed out, it is the account you need
 * before there is anything to pay for. Signed in, it is either the same
 * checkout the settings page starts — through `useCheckout`, so the two
 * cannot answer "what does upgrading do" differently — or, once paid, nothing
 * to click at all.
 */

const auth = useAuthStore()
const paid = ref(false)

onMounted(async () => {
  if (!auth.isAuthenticated) return
  try {
    const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
    const result = await $fetch<{ paid: boolean }>('/api/billing/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    paid.value = result.paid
  } catch {
    // Renders as free — the safe reading when the check itself failed.
  }
})

const { busy: checkoutBusy, error: checkoutError, startCheckout } = useCheckout()

interface Plan {
  readonly name: string
  readonly price: string
  readonly cadence: string
  readonly summary: string
  readonly includes: readonly string[]
  readonly cta: string
  readonly featured: boolean
}

const PLANS: readonly Plan[] = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    summary: 'Enough to find out whether this works for you, without a card.',
    includes: [
      'Every track and every exercise',
      'Real tests in a sandbox on each submission',
      '10 submissions, 20 runs, and 3 explanations a day',
      'Spaced repetition on what you have finished',
    ],
    cta: 'Create an account',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$12',
    cadence: 'per month',
    summary: 'For when you hit the daily limit and want to keep going.',
    includes: [
      'Everything in Free',
      'No daily submission, run, or explanation cap',
      'Explanations of failed submissions, unmetered',
    ],
    cta: 'Create an account',
    featured: true,
  },
]
</script>

<template>
  <section id="pricing">
    <div class="container py-16 md:py-24">
      <div class="max-w-md mb-12">
        <p class="eyebrow mb-3">pricing</p>
        <h2 class="display text-2xl md:text-3xl mb-4">You pay for what costs money to run.</h2>
        <p class="text-muted-foreground leading-relaxed">
          Every submission runs your code in its own microVM. That is the only part of this with a
          real cost, so it is the only thing the plans differ on.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2 md:gap-8 max-w-3xl">
        <div
          v-for="plan in PLANS"
          :key="plan.name"
          class="rounded border bg-card p-6 flex flex-col"
          :class="plan.featured ? 'border-rule-strong' : 'border-rule'"
        >
          <p class="eyebrow mb-4">{{ plan.name }}</p>

          <p class="mb-1 flex items-baseline gap-2">
            <!-- An undecided price renders as a dash. It never guesses. -->
            <span class="display text-3xl">{{ plan.price || '—' }}</span>
            <span class="font-mono text-xs text-muted-foreground">{{ plan.cadence }}</span>
          </p>

          <p class="text-sm text-muted-foreground leading-relaxed mb-6">{{ plan.summary }}</p>

          <p v-if="plan.featured" class="font-mono text-xs text-muted-foreground mb-6">
            MXN 219 &middot; EUR 11 &middot; local currency elsewhere
          </p>

          <ul class="space-y-2.5 mb-8 flex-1">
            <li
              v-for="item in plan.includes"
              :key="item"
              class="flex gap-2.5 text-sm leading-relaxed"
            >
              <span aria-hidden="true" class="font-mono text-signal select-none">·</span>
              <span>{{ item }}</span>
            </li>
          </ul>

          <div class="mt-auto">
            <Button
              v-if="!auth.isAuthenticated"
              to="/register"
              :variant="plan.featured ? 'primary' : 'outline'"
              class="w-full"
            >
              {{ plan.cta }}
            </Button>

            <template v-else-if="plan.featured">
              <p v-if="paid" class="text-sm text-muted-foreground">You are on Pro.</p>
              <template v-else>
                <Button
                  variant="primary"
                  class="w-full"
                  :loading="checkoutBusy"
                  @click="startCheckout"
                >
                  Upgrade — $12/month
                </Button>
                <p v-if="checkoutError" class="text-xs text-fail mt-2">{{ checkoutError }}</p>
              </template>
            </template>

            <p v-else class="text-sm text-muted-foreground">You already have an account.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
