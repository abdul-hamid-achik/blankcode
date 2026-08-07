/**
 * The site's canonical origin, without a trailing slash.
 *
 * Canonical URLs, OG tags and the sitemap all have to agree on one origin, and
 * a preview deployment must not advertise itself as the production site — a
 * canonical pointing at a preview URL is how duplicate pages get indexed.
 *
 * `NUXT_PUBLIC_SITE_URL` wins when set. Otherwise Vercel's `VERCEL_URL` gives
 * the deployment its own origin, which is right for previews and harmless in
 * production because the canonical there is overridden by the env var.
 */
export function useSiteUrl(): string {
  const config = useRuntimeConfig()
  const configured = config.public['siteUrl']
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/+$/, '')
  }
  return 'https://blankcode.dev'
}
