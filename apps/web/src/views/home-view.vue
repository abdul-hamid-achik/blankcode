<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Button from '@/components/ui/button.vue'
import Card from '@/components/ui/card.vue'

const features = [
  {
    title: 'Fill in the Blanks',
    description: 'Complete code snippets by filling in the missing parts. Learn by doing.',
  },
  {
    title: 'Multiple Languages',
    description: 'Practice TypeScript, Vue, React, Go, Rust, and more.',
  },
  {
    title: 'Track Progress',
    description: 'Monitor your learning journey with detailed progress tracking.',
  },
  {
    title: 'Instant Feedback',
    description: 'Get immediate feedback on your solutions with automated tests.',
  },
]
</script>

<template>
  <div>
    <section class="py-20 md:py-32">
      <div class="container text-center">
        <h1 class="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Master Code Through
          <span class="text-primary">Practice</span>
        </h1>
        <p class="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Interactive code completion exercises to help you learn programming concepts.
          Fill in the blanks, run tests, and level up your skills.
        </p>
        <div class="flex items-center justify-center gap-4">
          <RouterLink to="/register">
            <Button size="lg">Start Learning</Button>
          </RouterLink>
          <RouterLink to="/tracks">
            <Button variant="outline" size="lg">Browse Tracks</Button>
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="py-20 bg-muted/30">
      <div class="container">
        <h2 class="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card v-for="(feature, index) in features" :key="index">
            <h3 class="font-semibold mb-2">{{ feature.title }}</h3>
            <p class="text-sm text-muted-foreground">{{ feature.description }}</p>
          </Card>
        </div>
      </div>
    </section>

    <section class="py-20">
      <div class="container">
        <div class="max-w-3xl mx-auto">
          <Card :padding="false">
            <div class="rounded-t-xl bg-code-bg border-b border-border px-4 py-2 flex items-center gap-2">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500" />
                <div class="w-3 h-3 rounded-full bg-yellow-500" />
                <div class="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span class="text-sm text-muted-foreground ml-2">example.ts</span>
            </div>
            <pre class="p-4 font-mono text-sm overflow-x-auto"><code><span class="text-blue-400">function</span> <span class="text-yellow-300">greet</span>(name: <span class="text-green-400">string</span>): <span class="text-green-400">string</span> {
  <span class="text-purple-400">return</span> <span class="text-orange-300">`Hello, </span><span class="bg-code-blank-bg text-code-blank px-2 rounded">___</span><span class="text-orange-300">!`</span>;
}</code></pre>
          </Card>
        </div>
      </div>
    </section>
  </div>
</template>
