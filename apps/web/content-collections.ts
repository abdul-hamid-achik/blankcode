import { defineCollection, defineConfig } from '@content-collections/core'
import { compileMarkdown } from '@content-collections/markdown'
import { z } from 'zod'

const tutorials = defineCollection({
  name: 'tutorials',
  directory: '../../content/tutorials',
  include: '**/*.md',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    track: z.string().optional(),
    order: z.number(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    tags: z.array(z.string()),
  }),
  transform: async (document, context) => {
    const html = await compileMarkdown(context, document)
    return {
      ...document,
      html,
    }
  },
})

export default defineConfig({
  collections: [tutorials],
})
