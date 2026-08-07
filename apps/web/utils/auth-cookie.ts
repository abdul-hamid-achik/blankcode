/**
 * Options for the auth cookies, in one place because two modules write them.
 *
 * The store sets them at login and the API client overwrites them on refresh.
 * A cookie written with different options from either side is a different
 * cookie as far as the browser is concerned — so if the refresh path had kept
 * the defaults, a successful refresh would quietly have dropped `secure` and
 * `sameSite` from a session that started with them.
 *
 * `httpOnly` is deliberately absent. `useApi` reads the token in JavaScript to
 * build the Authorization header, so it has to be readable. That is a real
 * exposure — an XSS can take the token — and closing it means having the server
 * attach the credential instead, which changes how every request is made rather
 * than adding a flag. The choice is written down here so it stays a choice.
 */
export const AUTH_COOKIE_OPTIONS = {
  path: '/',
  // Off cross-site requests, but survives a normal top-level navigation back
  // into the app — a link from an email should not log you out.
  sameSite: 'lax',
  // Never sent over plain HTTP outside development.
  secure: !import.meta.dev,
} as const
