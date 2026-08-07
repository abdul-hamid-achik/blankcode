import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import type { PluginOption } from 'vite'

/**
 * The tracks that actually have content, read from the content directory at
 * build time.
 *
 * Not `TRACK_SLUGS` from the shared package: that lists every slug the database
 * enum accepts, which is a superset. `node` is a valid slug with no exercises
 * behind it, and building the sitemap from the wider list published a URL for a
 * page with nothing on it — a soft 404 offered to crawlers on purpose.
 *
 * Reading the directory means the two cannot drift: a track appears here when
 * someone writes content for it, and not before.
 */
const publishedTrackSlugs = readdirSync(resolve(__dirname, '../../content/tracks'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .toSorted()

export default defineNuxtConfig({
  modules: ['@nuxt/content', '@pinia/nuxt', '@nuxt/fonts'],

  // IBM Plex is the whole type system: Mono carries the display voice (the
  // product is literally code text), Sans carries prose. Self-hosted by
  // @nuxt/fonts so there is no CDN dependency at runtime.
  fonts: {
    families: [
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500, 600] },
      { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600] },
    ],
  },

  css: ['~/assets/css/main.css'],

  content: {
    build: {
      markdown: {
        highlight: {
          // Shiki writes both palettes into the HTML at build time: the
          // default colours inline, the dark ones as --shiki-dark variables.
          // `.dark` on <html> flips between them via the .article-body rules
          // in main.css — no client-side re-highlighting, so a crawler and a
          // reader get the same markup.
          theme: {
            default: 'github-light',
            dark: 'one-dark-pro',
          },
          langs: [
            'bash',
            'css',
            'diff',
            'go',
            'html',
            'js',
            'json',
            'jsx',
            'md',
            'python',
            'rust',
            'sql',
            'ts',
            'tsx',
            'vue',
            'yaml',
          ],
        },
      },
    },
  },

  app: {
    head: {
      link: [
        // SVG first for anything modern; .ico is the fallback Safari and
        // Windows still ask for, and a 404 there is visible in every tab.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'apple-touch-icon', href: '/favicon.svg' },
      ],
      meta: [{ name: 'theme-color', content: '#0d1017' }],
    },
  },

  vite: {
    plugins: [tailwindcss() as PluginOption],
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? '/api',
      // Canonical origin for canonical tags, OG urls and the sitemap. Set this
      // per environment so a preview never claims to be the production site.
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://blankcode.dev',
      // Set by Vercel on every deployment and absent everywhere else, which is
      // exactly the signal the analytics plugin needs: it must not report from
      // a laptop into production's numbers.
      vercelEnv: process.env.VERCEL_ENV ?? '',
    },
    // Server-only: the sitemap needs it, the browser does not.
    publishedTrackSlugs,
  },

  nitro: {
    // The Effect API is mounted at server/routes/api/[...].ts, so there is no
    // separate API process to proxy to — dev and production take the same path
    // through the same handler.
    vercel: {
      functions: {
        // Submissions execute inline in the request that creates them: 2-12s
        // for a warm sandbox, more when a snapshot is cold. The Vercel default
        // would cut a slow Rust run off mid-compile.
        maxDuration: 300,
      },
    },
  },

  routeRules: {
    /*
     * Headers every response carries. Vercel adds HSTS; nothing else was set.
     *
     * These matter more here than on a brochure site: the app holds an auth
     * token that JavaScript can read, and it renders code the reader wrote.
     *
     * No Content-Security-Policy yet. It is the one that would actually
     * contain an XSS, and it is also the one that silently breaks a page if a
     * directive is wrong — it needs a pass over every page with the console
     * open, not a guess added at the end of a session.
     */
    '/**': {
      headers: {
        // Stops a response being reinterpreted as a type it did not declare.
        'X-Content-Type-Options': 'nosniff',
        // The authenticated app has buttons that submit and delete; framing it
        // is how those get clicked by someone else.
        'X-Frame-Options': 'DENY',
        // URLs here carry exercise ids. Full paths should not reach third
        // parties through the Referer header.
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // Nothing here uses these, and saying so means a future dependency
        // cannot start.
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
    },
    '/': { ssr: true },
    '/tracks/**': { ssr: true },
    '/tutorials/**': { ssr: true },
    '/exercise/**': { ssr: false },
    /*
     * The signed-in hubs render on the server too. They were ssr:false,
     * which meant: empty shell, download the bundle, hydrate, and only then
     * start four or five API calls — the "everything takes forever" feel is
     * mostly that waterfall. Their pages now fetch with useAsyncData +
     * $fetch (in-process on the server), so the first paint carries the
     * content. The editor stays client-only (CodeMirror has no server
     * story), and settings/login/register render nothing worth streaming.
     */
    '/dashboard': { ssr: true },
    '/progress': { ssr: true },
    '/settings': { ssr: false },
    '/login': { ssr: false },
    '/register': { ssr: false },
    /*
     * The public catalogue barely changes and is identical for everyone —
     * exercises are redacted server-side and tracks/paths carry no user
     * state. SWR caching serves them from the edge and revalidates in the
     * background, instead of a Postgres round trip per pageview. Exact paths
     * on purpose: /api/exercises/:id/progress and /draft are per-user and
     * must never share a cache.
     */
    '/api/exercises': { swr: 300 },
    '/api/paths': { swr: 300 },
    '/api/tracks/**': { swr: 300 },
  },

  typescript: {
    strict: true,
  },

  compatibilityDate: '2024-11-01',
})
