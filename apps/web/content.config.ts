import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineContentConfig({
  collections: {
    tutorials: defineCollection({
      type: 'page',
      // @nuxt/content v3 LocalSource format: cwd + include
      source: {
        cwd: resolve(__dirname, '../../content/tutorials'),
        prefix: '/tutorials',
        include: '**/*.md',
      },
      schema: z.object({
        title: z.string(),
        slug: z.string(),
        description: z.string(),
        order: z.number().default(0),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        tags: z.array(z.string()).default([]),
        track: z.string().optional(),
      }),
    }),
  },
})
