import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `useAsync(fn)` does not fetch — `immediate` defaults to false.
 *
 * Four pages (challenges, achievements, paths, path detail) shipped without
 * ever calling `execute()`, so they rendered empty lists forever while the API
 * happily returned data. Nothing failed; the pages just looked like there was
 * no content. This guard makes that mistake loud.
 */

const webRoot = process.cwd()
const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', '.histoire', 'dist'])

function collectVueFiles(dir: string, found: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir, { encoding: 'utf-8' })
  } catch {
    return found
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectVueFiles(full, found)
    else if (entry.endsWith('.vue')) found.push(full)
  }
  return found
}

const consumers = [
  ...collectVueFiles(join(webRoot, 'pages')),
  ...collectVueFiles(join(webRoot, 'components')),
]
  .map((file) => ({ file, source: readFileSync(file, 'utf-8') }))
  .filter(({ source }) => source.includes('useAsync('))

describe('useAsync consumers actually fetch', () => {
  it('finds the files that use useAsync', () => {
    expect(consumers.length).toBeGreaterThan(0)
  })

  it.each(consumers.map(({ file, source }) => [relative(webRoot, file), source]))(
    '%s triggers its own fetch',
    (_name, source) => {
      // Every `useAsync` call in the file must be matched by either an
      // `immediate` flag or a renamed `execute` that is invoked somewhere.
      const callCount = (source.match(/useAsync\(/g) ?? []).length

      const immediateCount = (source.match(/useAsync\([\s\S]*?,\s*true\s*\)/g) ?? []).length

      // `execute: loadThing` -> check `loadThing` is called.
      const renamed = [...source.matchAll(/execute:\s*(\w+)/g)].map((m) => m[1] as string)
      const invokedRenames = renamed.filter((name) =>
        new RegExp(`\\b${name}\\s*\\(|onMounted\\(\\s*${name}\\s*\\)`).test(
          source.replace(new RegExp(`execute:\\s*${name}`, 'g'), '')
        )
      )

      const plainExecuteCalls = (source.match(/\bexecute\(\)/g) ?? []).length

      const wired = immediateCount + invokedRenames.length + plainExecuteCalls

      expect(
        wired,
        'useAsync() never fetches on its own — pass `true` as the second argument or call execute()'
      ).toBeGreaterThanOrEqual(callCount)
    }
  )
})
