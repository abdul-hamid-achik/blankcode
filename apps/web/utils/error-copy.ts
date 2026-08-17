export interface ErrorAction {
  label: string
  /** Where to go. Omitted when `reload` is set. */
  to?: string
  /** Re-run the current route instead of navigating away. */
  reload?: boolean
  /** Append `?redirect=` of the current path — used by the 401 Sign in. */
  redirect?: boolean
}

export interface ErrorCopy {
  /** Short mono label rendered above the status code. */
  eyebrow: string
  /** What happened, stated plainly. Never apologises, never vague. */
  title: string
  /** What to do about it. */
  body: string
  actions: ErrorAction[]
}

const TRACKS: ErrorAction = { label: 'Go to tracks', to: '/tracks' }
const RETRY: ErrorAction = { label: 'Try again', reload: true }

/**
 * Every status the API can actually produce gets its own copy.
 *
 * The API's tagged errors map to 400/401/403/404/409/429/500; 402 comes from
 * the Vercel AI Gateway when the generation budget is spent; 502/503/504 come
 * from the API being down or a submission exceeding the sandbox ceiling.
 */
export const ERROR_COPY: Record<number, ErrorCopy> = {
  400: {
    eyebrow: 'bad request',
    title: 'That request was malformed.',
    body: 'The page asked for something the server could not read. Reloading usually clears it.',
    actions: [RETRY, TRACKS],
  },
  401: {
    eyebrow: 'not signed in',
    title: 'This page needs you signed in.',
    body: 'Your session expired or was never started. Sign in and you will land back here.',
    actions: [{ label: 'Sign in', to: '/login', redirect: true }, TRACKS],
  },
  402: {
    eyebrow: 'budget reached',
    title: 'The AI budget for this month is spent.',
    body: 'Exercise generation runs through the Vercel AI Gateway. Top up credits or raise the budget, then try again. Everything that does not need a model still works.',
    actions: [RETRY, TRACKS],
  },
  403: {
    eyebrow: 'forbidden',
    title: 'Your account cannot open this.',
    body: 'This page is limited to operator accounts. If you think that is a mistake, sign in with the address that should have access.',
    actions: [TRACKS],
  },
  404: {
    eyebrow: 'not found',
    title: 'Nothing lives at this address.',
    body: 'The page moved, or the track, concept, or exercise slug no longer exists. Content is imported from markdown, so a missing exercise usually means it has not been imported yet.',
    actions: [TRACKS, { label: 'Go home', to: '/' }],
  },
  409: {
    eyebrow: 'conflict',
    title: 'That already exists.',
    body: 'Something with the same identifier is already stored. Pick a different one.',
    actions: [RETRY, TRACKS],
  },
  429: {
    eyebrow: 'rate limited',
    title: 'You are going faster than the limiter allows.',
    body: 'The API caps submissions at 30/min and auth attempts at 5/min. Wait a moment and continue — nothing was lost.',
    actions: [RETRY, TRACKS],
  },
  500: {
    eyebrow: 'server error',
    title: 'The API failed on that one.',
    body: 'This is a bug, not something you did. Try again in a moment. If it keeps happening, the tracks page still works.',
    actions: [RETRY, TRACKS],
  },
  502: {
    eyebrow: 'bad gateway',
    title: 'The API answered with nonsense.',
    body: 'Usually the API restarted mid-request. Give it a few seconds, then try again.',
    actions: [RETRY, TRACKS],
  },
  503: {
    eyebrow: 'unavailable',
    title: 'The API is not accepting requests.',
    body: 'The site is up; the API is not answering. Wait a moment and try again.',
    actions: [RETRY, TRACKS],
  },
  504: {
    eyebrow: 'timeout',
    title: 'The API took too long.',
    body: 'A run that exceeds the sandbox ceiling is stopped. Try again; if this keeps happening, the suite may be looping.',
    actions: [RETRY, TRACKS],
  },
}

export const FALLBACK_COPY: ErrorCopy = {
  eyebrow: 'unexpected',
  title: 'Something broke on the way here.',
  body: 'No handler matched this failure. Reloading is the fastest way out.',
  actions: [RETRY, TRACKS],
}

/** Never returns undefined — an unmapped status still gets a usable page. */
export function copyForStatus(statusCode: number | string | undefined): ErrorCopy {
  const code = Number(statusCode)
  if (!Number.isFinite(code)) return FALLBACK_COPY
  return ERROR_COPY[code] ?? FALLBACK_COPY
}
