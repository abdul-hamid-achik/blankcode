import { getVercelOidcToken } from '@vercel/oidc'

/**
 * Local development only: primes `process.env.VERCEL_OIDC_TOKEN` from the
 * Vercel CLI's login, so nothing has to be pulled into an env file first.
 *
 * `@vercel/oidc` can mint a token itself — it reads the CLI's auth.json and
 * this repo's `.vercel/project.json`, caches the result, and refreshes it when
 * it expires. `@vercel/sandbox` and the AI Gateway provider both go through it
 * on every use, so they stay authenticated on their own. The one thing that
 * does not is our own AI route guards, which look at `process.env` directly and
 * would report "AI is not configured" before the first SDK call ever runs.
 * Calling `getVercelOidcToken()` once at startup sets the variable as a side
 * effect, which is all the guards need.
 *
 * On Vercel the platform provides the token and this returns immediately.
 */
export default defineNitroPlugin(() => {
  if (process.env['VERCEL']) return
  if (process.env['AI_GATEWAY_API_KEY'] || process.env['VERCEL_OIDC_TOKEN']) return

  getVercelOidcToken().catch((error) => {
    // Not fatal: submissions and everything non-AI work without it. This is
    // the situation `vercel login` fixes, so say so instead of a stack trace.
    console.warn(
      `[dev-oidc] Could not mint a Vercel OIDC token from the CLI login — AI features stay off. Run \`vercel login\` and restart. (${String(error).split('\n')[0]})`
    )
  })
})
