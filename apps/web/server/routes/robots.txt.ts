/**
 * robots.txt, generated so that preview deployments cannot be indexed.
 *
 * A preview that allows crawling competes with production for the same content
 * and splits its ranking. `VERCEL_ENV` is the only reliable signal for which
 * one this is, and it is set by the platform rather than by us.
 *
 * The authenticated areas are disallowed too. They are useless to a crawler —
 * every one of them redirects to /login — and crawling them wastes the budget
 * that should go to the articles.
 */

const PRIVATE_PATHS = [
  '/api/',
  '/dashboard',
  '/settings',
  '/progress',
  '/review',
  '/exercise/',
  '/achievements',
  // Operator-only. It answers 404 to anyone else, but there is no reason for a
  // crawler to be probing it in the first place.
  '/admin',
  '/login',
  '/register',
]

export default defineEventHandler((event) => {
  const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')
  const isProduction = process.env['VERCEL_ENV'] === 'production' || !process.env['VERCEL']

  const body = isProduction
    ? `User-agent: *
${PRIVATE_PATHS.map((path) => `Disallow: ${path}`).join('\n')}

Sitemap: ${site}/sitemap.xml
`
    : `# Preview deployment — not the canonical site.
User-agent: *
Disallow: /
`

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return body
})
