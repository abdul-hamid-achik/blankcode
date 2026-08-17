<script setup lang="ts">
import { LANDING_TRACKS } from '~/utils/landing-tracks'

// The list and every count come from `~/utils/landing-tracks`, which
// `apps/web/__tests__/landing-tracks.test.ts` pins to `content/tracks/` —
// linking a slug with no imported content lands the user on an empty page.
</script>

<template>
  <section class="border-b border-rule">
    <div class="container py-16 md:py-20">
      <p class="eyebrow mb-3">tracks</p>
      <h2 class="display text-2xl md:text-3xl mb-3 max-w-lg">
        {{ LANDING_TRACKS.length }} languages, each ordered from basics to the parts you forget
        first.
      </h2>
      <p class="text-muted-foreground max-w-xl mb-10">
        Alongside the blanks, every track carries standalone challenges, plus code-review,
        specification, and build-the-tool work: reading code you did not write, pinning a request
        down, and automating the check.
      </p>

      <ul class="grid gap-px bg-rule border border-rule sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="track in LANDING_TRACKS" :key="track.slug" class="bg-background">
          <NuxtLink
            :to="`/tracks/${track.slug}`"
            class="group flex items-center gap-4 p-5 transition-colors hover:bg-muted/60"
          >
            <span
              class="h-8 w-1 shrink-0 rounded-full"
              :style="{ backgroundColor: track.color }"
              aria-hidden="true"
            />
            <span class="display text-base">{{ track.name }}</span>
            <span class="ml-auto font-mono text-xs text-muted-foreground">
              {{ track.exercises }} exercises
            </span>
            <span
              class="font-mono text-xs text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
              >&rarr;</span
            >
          </NuxtLink>
        </li>
      </ul>

      <p class="mt-6 text-sm text-muted-foreground">
        Learning paths order the challenges into ladders —
        <NuxtLink
          to="/paths"
          class="text-foreground underline decoration-signal/60 underline-offset-2 hover:decoration-signal"
          >browse the paths</NuxtLink
        >.
      </p>
    </div>
  </section>
</template>
