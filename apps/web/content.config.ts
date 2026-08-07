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
        /**
         * Where to practice what this teaches: a concept in the track. The
         * whole thesis of the product is that reading is not practicing —
         * so a tutorial that ends with "Back to Tutorials" ends by
         * contradicting it.
         */
        practice: z.object({ concept: z.string(), label: z.string() }).optional(),
      }),
    }),

    /*
     * Articles. Separate from tutorials on purpose: tutorials teach a concept
     * inside a track and are ordered within it, while a post is standalone and
     * dated, and is what search engines are meant to find.
     */
    blog: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, '../../content/blog'),
        prefix: '/blog',
        include: '**/*.md',
      },
      schema: z.object({
        title: z.string(),
        description: z.string(),
        // Kept as a string: the date is authored, not computed, and parsing it
        // into a Date here would only make it a string again on the wire.
        date: z.string(),
        author: z.string().default('BlankCode'),
        tags: z.array(z.string()).default([]),
        // Opt a post out of the sitemap and listing without deleting the file.
        draft: z.boolean().default(false),
        // Overrides the auto-generated OG description when the post needs a
        // different pitch for social cards than for the page itself.
        ogDescription: z.string().optional(),
      }),
    }),
  },
})
