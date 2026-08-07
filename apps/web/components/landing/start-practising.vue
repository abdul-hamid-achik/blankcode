<script setup lang="ts">
import Button from '~/components/ui/button.vue'

/**
 * The closing section. It used to tell the reader to clone the repository and
 * run three commands, from when BlankCode was something you hosted. It is a
 * service now, so the only call to action is to start — running it yourself is
 * not on offer, and copy implying otherwise trades a signup for nothing.
 */
const STEPS = [
  'Pick a track — seven languages',
  'Fill in the blanks in working code',
  'Real tests run in a sandbox and answer immediately',
]
</script>

<template>
  <section>
    <div class="container py-16 md:py-24">
      <div class="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
        <div>
          <p class="eyebrow mb-3">start practising</p>
          <h2 class="display text-2xl md:text-3xl mb-4 max-w-md">
            Nothing to install. Nothing to configure.
          </h2>
          <p class="text-muted-foreground leading-relaxed max-w-md mb-8">
            Your code runs in an isolated microVM that exists for the length of one submission and
            is destroyed after it. You get the real test output, not a similarity score.
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
            <span class="eyebrow">how a session goes</span>
          </div>
          <div class="p-5">
            <ol class="space-y-4">
              <li
                v-for="(step, index) in STEPS"
                :key="step"
                class="flex gap-3 text-sm leading-relaxed text-muted-foreground"
              >
                <span class="font-mono text-signal select-none">{{ index + 1 }}</span>
                <span>{{ step }}</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
