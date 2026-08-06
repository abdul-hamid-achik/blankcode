<script setup lang="ts">
// Keep in sync with the track directories under `content/tracks/` — linking to
// a slug with no imported content lands the user on an empty track page.
// `apps/web/__tests__/landing-tracks.test.ts` enforces this.
const languages = [
  { name: 'TypeScript', slug: 'typescript', color: '#3178C6' },
  { name: 'Python', slug: 'python', color: '#3776AB' },
  { name: 'Go', slug: 'go', color: '#00ADD8' },
  { name: 'Rust', slug: 'rust', color: '#DEA584' },
  { name: 'Vue', slug: 'vue', color: '#4FC08D' },
  { name: 'React', slug: 'react', color: '#61DAFB' },
]
</script>

<template>
  <section class="border-b border-rule">
    <div class="container py-16 md:py-20">
      <p class="eyebrow mb-3">tracks</p>
      <h2 class="display text-2xl md:text-3xl mb-3 max-w-lg">
        {{ languages.length }} languages, each ordered from basics to the parts you forget first.
      </h2>
      <p class="text-muted-foreground max-w-lg mb-10">
        Tracks are plain markdown in <code class="font-mono text-sm">content/tracks/</code>. Adding
        one is a directory and an import.
      </p>

      <ul class="grid gap-px bg-rule border border-rule sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="lang in languages" :key="lang.slug" class="bg-background">
          <NuxtLink
            :to="`/tracks/${lang.slug}`"
            class="group flex items-center gap-4 p-5 transition-colors hover:bg-muted/60"
          >
            <span
              class="h-8 w-1 shrink-0 rounded-full"
              :style="{ backgroundColor: lang.color }"
              aria-hidden="true"
            />
            <span class="display text-base">{{ lang.name }}</span>
            <span
              class="ml-auto font-mono text-xs text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
              >&rarr;</span
            >
          </NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>
