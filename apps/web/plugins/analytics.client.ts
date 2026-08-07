import { inject } from '@vercel/analytics'

/**
 * Vercel Analytics.
 *
 * Client-only, because it instruments what a browser does. Off outside Vercel
 * so a local run does not post events into production's numbers — the package
 * would send them to a `/_vercel/insights` endpoint that only exists on the
 * platform, and the resulting console errors read like a broken app.
 *
 * `mode` follows the deployment: preview traffic is our own testing and would
 * otherwise be indistinguishable from real visitors in the dashboard.
 */
export default defineNuxtPlugin(() => {
  const env = useRuntimeConfig().public['vercelEnv'] as string | undefined
  if (!env) return

  inject({ mode: env === 'production' ? 'production' : 'development' })
})
