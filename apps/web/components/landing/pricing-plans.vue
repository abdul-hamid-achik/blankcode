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
 * The shape encodes the recommendation in the monetisation note: a free tier
 * with a real limit, and a paid tier whose entire pitch is removing that limit.
 * The limit is what costs money to serve — submissions run a microVM each —
 * so the thing being sold is the thing being spent, rather than a seat.
 */

interface Plan {
  readonly name: string
  /** Fill in when decided. Empty renders as "—", never as a guess. */
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
    price: '',
    cadence: 'forever',
    summary: 'Enough to find out whether this works for you, without a card.',
    includes: [
      'Every track and every exercise',
      'Real tests in a sandbox on each submission',
      'A daily submission limit',
      'Spaced repetition on what you have finished',
    ],
    cta: 'Create an account',
    featured: false,
  },
  {
    name: 'Unlimited',
    price: '',
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
