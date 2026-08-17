/**
 * Where to send someone after they sign in or register.
 *
 * A redirect that is not a same-origin path is how an open-redirect lands
 * a session on a phishing page. The fallback is the habit home.
 */

export function safeInternalRedirect(redirect: unknown, fallback = '/dashboard'): string {
  if (typeof redirect !== 'string') return fallback
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return fallback
  return redirect
}

/**
 * A phrase for the login/register form when the visitor was mid-task.
 * Null when the destination is just "the app" and naming it would be noise.
 */
export function destinationHint(path: string): string | null {
  if (path.startsWith('/exercise/')) return 'the exercise you picked'
  if (path.startsWith('/reading/')) return 'that reading'
  if (path === '/connect') return 'connect your agent'
  if (path.startsWith('/paths/')) return 'that path'
  return null
}
