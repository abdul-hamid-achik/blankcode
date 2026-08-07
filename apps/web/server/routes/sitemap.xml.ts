import { queryCollection } from '@nuxt/content/nitro'

/**
 * The sitemap, built from the content collections rather than a hand-kept list,
 * so a new article is discoverable the moment it is committed.
 *
 * Written as a Nitro route instead of pulling in a sitemap module: the app
 * already runs a server, the rules here are a dozen lines, and a route can be
 * tested by requesting it.
 *
 * Only pages worth indexing are listed. Anything behind auth (dashboard,
 * exercises, settings) is deliberately absent — those pages are useless to a
 * search engine and would only dilute the crawl.
 */

interface Entry {
  loc: string
  changefreq: 'daily' | 'weekly' | 'monthly'
  priority: string
  lastmod?: string
}

const STATIC_ROUTES: Entry[] = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/blog', changefreq: 'weekly', priority: '0.8' },
  { loc: '/tutorials', changefreq: 'weekly', priority: '0.8' },
  { loc: '/tracks', changefreq: 'weekly', priority: '0.7' },
  { loc: '/challenges', changefreq: 'weekly', priority: '0.6' },
  { loc: '/paths', changefreq: 'weekly', priority: '0.6' },
  { loc: '/privacy', changefreq: 'monthly', priority: '0.2' },
  { loc: '/terms', changefreq: 'monthly', priority: '0.2' },
]

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default defineEventHandler(async (event) => {
  const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')

  const entries = [...STATIC_ROUTES]

  // Content failing to load must not take the sitemap down with it: a sitemap
  // missing its articles is recoverable, a 500 tells crawlers the site is dead.
  try {
    const posts = await queryCollection(event, 'blog').all()
    for (const post of posts as unknown as Array<{ path: string; date: string; draft: boolean }>) {
      if (post.draft) continue
      entries.push({
        loc: post.path,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: post.date,
      })
    }

    const tutorials = await queryCollection(event, 'tutorials').all()
    for (const tutorial of tutorials as unknown as Array<{ path: string }>) {
      entries.push({ loc: tutorial.path, changefreq: 'monthly', priority: '0.6' })
    }
  } catch (error) {
    console.error('[sitemap] content query failed, serving static routes only:', String(error))
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(site + entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return body
})
