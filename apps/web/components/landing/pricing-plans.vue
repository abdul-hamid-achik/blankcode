<script setup lang="ts">
import Button from '~/components/ui/button.vue'

/**
 * The pricing section. Built, deliberately not mounted.
 *
 * `pages/index.vue` has a gap where this goes. It stays out of the page until
 * the plans are decided, because the alternative is shipping invented numbers
 * to a live site and a price is the one piece of copy a visitor is entitled to
 * treat as a promise.
 *
 * To turn it on: import it in `pages/index.vue`, put `<PricingPlans />` in the
 * gap, and fill in the two `price` fields below. Nothing else has to move.
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
 */

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
      '10 submissions a day',
      'Spaced repetition on what you have finished',
    ],
    cta: 'Create an account',
    featured: false,
  },
  {
    name: 'Unlimited',
    price: '$12',
    cadence: 'per month',
    summary: 'For when you hit the daily limit and want to keep going.',
    includes: [
      'Everything in Free',
      'No daily submission limit',
      'Explanations of failed submissions, unmetered',
      'The full review queue',
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
          :class="plan.featured ? 'border-signal' : 'border-rule-strong'"
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

          <NuxtLink to="/register" class="mt-auto">
            <Button :variant="plan.featured ? 'primary' : 'outline'" class="w-full">
              {{ plan.cta }}
            </Button>
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
