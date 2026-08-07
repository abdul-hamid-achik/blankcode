import { useSiteUrl } from '~/composables/useSiteUrl'

/**
 * Title, description, canonical and social card for a public page.
 *
 * Written because the landing page — the URL people actually paste into Slack
 * and post on Twitter — had no Open Graph tags and no canonical at all. Only
 * the blog had them, because that was the page someone remembered to do by
 * hand. Sharing blankcode.dev anywhere produced a bare link with no title, no
 * description and no image.
 *
 * The canonical matters twice over here: preview.blankcode.dev serves the same
 * pages, and without one a search engine can index the preview copy and treat
 * it as a duplicate of production, or instead of it.
 */

export interface PageSeo {
  readonly title: string
  readonly description: string
  /** Path only, e.g. `/tracks`. The origin comes from runtime config. */
  readonly path: string
  /** `article` for a blog post; everything else is a page. */
  readonly type?: 'website' | 'article'
  /** Absolute or root-relative. Falls back to the shared card. */
  readonly image?: string
  /**
   * Overrides the social-card description only. A post sometimes needs a
   * different pitch on a timeline than in a search snippet; the page
   * description stays as written.
   */
  readonly ogDescription?: string
  /** ISO date. Emitted as article:published_time when `type` is `article`. */
  readonly publishedTime?: string
  /** Emitted as article:author when `type` is `article`. */
  readonly author?: string
}

const DEFAULT_IMAGE = '/og.png'

export function usePageSeo(page: PageSeo): void {
  const site = useSiteUrl()
  const url = `${site}${page.path === '/' ? '' : page.path}`
  const image = page.image?.startsWith('http')
    ? page.image
    : `${site}${page.image ?? DEFAULT_IMAGE}`

  const socialDescription = page.ogDescription ?? page.description
  const isArticle = page.type === 'article'

  useSeoMeta({
    title: page.title,
    description: page.description,
    ogTitle: page.title,
    ogDescription: socialDescription,
    ogType: page.type ?? 'website',
    ogUrl: url,
    ogImage: image,
    ogSiteName: 'BlankCode',
    // `summary_large_image` rather than `summary`: the card is a wide code
    // panel, and the small variant crops it to an unreadable square.
    twitterCard: 'summary_large_image',
    twitterTitle: page.title,
    twitterDescription: socialDescription,
    twitterImage: image,
    // article:* tags are only valid alongside og:type article; emitting them
    // on a website page would just be noise for a parser.
    ...(isArticle && page.publishedTime ? { articlePublishedTime: page.publishedTime } : {}),
    ...(isArticle && page.author ? { articleAuthor: [page.author] } : {}),
  })

  useHead({
    link: [{ rel: 'canonical', href: url }],
  })
}
