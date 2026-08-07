/**
 * Pure helpers for the blog pages.
 *
 * Kept out of the components so they can be tested under plain Vitest — the
 * pages only format and render what these functions decide.
 */

/**
 * Counts the words in a parsed @nuxt/content body.
 *
 * Works on both shapes v3 can hand a page: the "minimal"/minimark tree
 * (`['p', {…props}, 'text', […child]]` with bare strings as text nodes) and
 * hast-style objects (`{ type: 'text', value }` / `{ children: […] }`). The
 * walker is defensive on purpose: a shape it does not recognise counts as
 * zero words rather than throwing during render.
 */
export function countWords(node: unknown): number {
  if (typeof node === 'string') {
    return node.split(/\s+/).filter(Boolean).length
  }
  if (Array.isArray(node)) {
    // A minimark element is ['tag', { props }, ...children]; anything else is
    // a plain list of nodes.
    const isElement =
      typeof node[0] === 'string' &&
      node[1] !== null &&
      typeof node[1] === 'object' &&
      !Array.isArray(node[1])
    const children = isElement ? node.slice(2) : node
    return children.reduce<number>((total, child) => total + countWords(child), 0)
  }
  if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>
    // Covers the body wrapper ({ type: 'minimal', value: [...] }) and hast
    // text nodes ({ type: 'text', value: '...' }).
    if (record['value'] !== undefined) return countWords(record['value'])
    if (Array.isArray(record['children'])) return countWords(record['children'])
  }
  return 0
}

/**
 * Reading time in whole minutes, never zero.
 *
 * 225 words per minute is the middle of the adult silent-reading range. Code
 * blocks count as words, which overweights them slightly — appropriate here,
 * since code is read more slowly than prose.
 */
export function readingMinutes(body: unknown): number {
  return Math.max(1, Math.round(countWords(body) / 225))
}

export interface DatedEntry {
  readonly date?: string | null
  readonly path?: string | null
}

/**
 * Newest first, with the path as a deterministic tiebreak.
 *
 * The tiebreak matters: several posts share a publication date, and prev/next
 * on the post page must walk the exact order the index shows. Dates are
 * compared as strings — they are authored ISO dates, and an unquoted YAML
 * date arrives here as null, which sorts last instead of crashing the page.
 */
export function sortPostsNewestFirst<T extends DatedEntry>(posts: readonly T[]): T[] {
  return posts.toSorted((a, b) => {
    const byDate = String(b.date ?? '').localeCompare(String(a.date ?? ''))
    if (byDate !== 0) return byDate
    return String(a.path ?? '').localeCompare(String(b.path ?? ''))
  })
}
