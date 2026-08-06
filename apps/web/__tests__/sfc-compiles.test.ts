import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { compileTemplate, parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

/**
 * Every `.vue` file must survive Vue's SFC + template compiler.
 *
 * This exists because `vue-tsc` does NOT catch malformed template expressions:
 * oxfmt once reflowed `@click="a(); b = false"` into two semicolon-less lines,
 * which typecheck happily accepted and only `nuxt build` rejected. A formatter
 * that can emit non-compiling templates needs a cheap guard in the test suite.
 */

const webRoot = process.cwd()
const SEARCH_DIRS = ['components', 'pages', 'layouts']
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
    if (statSync(full).isDirectory()) {
      collectVueFiles(full, found)
    } else if (entry.endsWith('.vue')) {
      found.push(full)
    }
  }
  return found
}

const vueFiles = [
  ...SEARCH_DIRS.flatMap((dir) => collectVueFiles(join(webRoot, dir))),
  join(webRoot, 'app.vue'),
].filter((file) => {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
})

describe('Vue SFCs compile', () => {
  it('finds the component files to check', () => {
    expect(vueFiles.length).toBeGreaterThan(10)
  })

  it.each(vueFiles.map((file) => [relative(webRoot, file), file]))('%s', (_name, file) => {
    const source = readFileSync(file, 'utf-8')
    const { descriptor, errors } = parse(source, { filename: file })
    expect(errors, `SFC parse errors in ${file}`).toEqual([])

    if (descriptor.template) {
      const compiled = compileTemplate({
        source: descriptor.template.content,
        filename: file,
        id: file,
      })
      expect(compiled.errors, `template compile errors in ${file}`).toEqual([])
    }
  })
})
