import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Track and concept doors are the first sentences a new account reads.
 * LMS filler ("Master X", "Learn Y") is the voice the rest of the site left.
 */

const fromWeb = resolve(process.cwd(), '../../content/tracks')
const fromRoot = resolve(process.cwd(), 'content/tracks')
const contentTracks = existsSync(fromWeb) ? fromWeb : fromRoot

function yamlFiles(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((file) => file.endsWith('_track.yaml') || file.endsWith('_concept.yaml'))
    .map((file) => resolve(dir, file))
}

const LMS = /\b(Master|Learn|Discover|Dive into|Explore)\b/

describe('track and concept copy', () => {
  it('does not open a door with courseware filler', () => {
    const hits: string[] = []
    for (const file of yamlFiles(contentTracks)) {
      const text = readFileSync(file, 'utf-8')
      const line = text.split('\n').find((row) => row.startsWith('description:'))
      if (line && LMS.test(line)) hits.push(`${file}: ${line}`)
    }
    expect(hits).toEqual([])
  })
})
