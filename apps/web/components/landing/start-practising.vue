<script setup lang="ts">
import Button from '~/components/ui/button.vue'

/**
 * The close. The page has shown the gesture (hero), the screen (frame), the
 * system (loop), and the breadth (tracks); what is left to say is what an
 * account adds — the memory. The card lists exactly that, nothing else.
 */
const KEEPS = [
  {
    term: 'progress',
    detail: 'Where you are in every track and learning path, per concept.',
  },
  {
    term: 'schedule',
    detail: 'A review date per exercise, pushed out on every pass and reset by a fail.',
  },
  {
    term: 'record',
    detail: 'Streaks and achievements as the practice accumulates.',
  },
]
</script>

<template>
  <section>
    <div class="container py-16 md:py-24">
      <div class="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
        <div>
          <p class="eyebrow mb-3">start practising</p>
          <h2 class="display text-2xl md:text-3xl mb-4 max-w-md">
            Nothing to install. The account does the remembering.
          </h2>
          <p class="text-muted-foreground leading-relaxed max-w-md mb-8">
            Exercises run in the browser against a microVM that exists for one submission and is
            destroyed after it. What persists is yours: where you are, and when each exercise comes
            back.
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <NuxtLink to="/register">
              <Button size="lg">Create an account</Button>
            </NuxtLink>
            <NuxtLink to="/tracks">
              <Button variant="outline" size="lg">Browse the tracks</Button>
            </NuxtLink>
          </div>
        </div>

        <div class="rounded border border-rule-strong bg-card overflow-hidden">
          <div class="border-b border-rule px-4 py-2.5 bg-muted/40">
            <span class="eyebrow">what an account holds</span>
          </div>
          <dl class="p-5 space-y-5">
            <div v-for="keep in KEEPS" :key="keep.term" class="flex gap-4">
              <dt class="eyebrow text-signal w-20 shrink-0 pt-0.5">{{ keep.term }}</dt>
              <dd class="text-sm leading-relaxed text-muted-foreground">{{ keep.detail }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>
