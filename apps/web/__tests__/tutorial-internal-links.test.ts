import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Tutorial prose links to other tutorials by path. A hyphenated slug that
 * does not match `content/tutorials/{track}/{file}` 404s on the live site —
 * `/tutorials/typescript-type-narrowing` did exactly that.
 */

const tutorialsDir = join(process.cwd(), '../../content/tutorials')

function collectMarkdown(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectMarkdown(full, found)
    else if (entry.endsWith('.md')) found.push(full)
  }
  return found
}

function hrefToFile(href: string): string | null {
  const path = href.replace(/^\/tutorials\/?/, '')
  if (!path) return join(tutorialsDir, 'index.md')
  const candidates = [join(tutorialsDir, `${path}.md`), join(tutorialsDir, path, 'index.md')]
  return candidates.find((file) => existsSync(file)) ?? null
}

describe('tutorial internal links', () => {
  const files = collectMarkdown(tutorialsDir)
  const links = files.flatMap((file) => {
    const body = readFileSync(file, 'utf-8')
    const hrefs = [...body.matchAll(/\]\((\/tutorials\/[^)#\s]+)\)/g)].map((m) => m[1]!)
    return hrefs.map((href) => ({ file: relative(tutorialsDir, file), href }))
  })

  it('finds the authored cross-links', () => {
    expect(links.length).toBeGreaterThan(0)
  })

  it.each(links)('$file → $href exists', ({ href }) => {
    expect(hrefToFile(href) ?? `missing ${href}`).not.toBe(`missing ${href}`)
  })
})
