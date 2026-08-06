<script setup lang="ts">
import Button from '~/components/ui/button.vue'

/**
 * The honest closing section for a self-hosted tool: there is nothing to buy
 * and no one to sign up with. The only real call to action is "run it".
 */
const SETUP = [
  'git clone https://github.com/abdul-hamid-achik/blankcode.git',
  'bun install && docker compose up -d',
  'bun run content:import',
]
</script>

<template>
  <section>
    <div class="container py-16 md:py-24">
      <div class="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
        <div>
          <p class="eyebrow mb-3">run it yourself</p>
          <h2 class="display text-2xl md:text-3xl mb-4 max-w-md">
            It runs on your machine, against your Postgres.
          </h2>
          <p class="text-muted-foreground leading-relaxed max-w-md mb-8">
            No account on someone else's server, no plan, no telemetry. Your submissions and your
            review schedule stay in a database you own.
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <NuxtLink to="/register">
              <Button size="lg">Create a local account</Button>
            </NuxtLink>
            <a
              href="https://github.com/abdul-hamid-achik/blankcode"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="lg">Read the source</Button>
            </a>
          </div>
        </div>

        <div class="rounded border border-rule-strong bg-card overflow-hidden">
          <div class="border-b border-rule px-4 py-2.5 bg-muted/40">
            <span class="eyebrow">three commands</span>
          </div>
          <div class="p-5 overflow-x-auto">
            <pre
              class="font-mono text-xs md:text-sm leading-loose text-muted-foreground"
            ><code v-for="line in SETUP" :key="line" class="block"><span class="select-none text-signal">$ </span>{{ line }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
