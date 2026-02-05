import type { Difficulty } from '@blankcode/shared'

export interface GenerateOptions {
  track: string
  concept: string
  difficulty: Difficulty
  topic?: string
}

export interface TrackScaffold {
  trackYaml: string
  concepts: Array<{ slug: string; yaml: string }>
}

const TRACK_CONFIG: Record<
  string,
  { codeLanguage: string; testFramework: string; testExample: string }
> = {
  typescript: {
    codeLanguage: 'typescript',
    testFramework: 'vitest',
    testExample: "import { expect, test } from 'vitest'",
  },
  javascript: {
    codeLanguage: 'javascript',
    testFramework: 'vitest',
    testExample: "import { expect, test } from 'vitest'",
  },
  vue: {
    codeLanguage: 'vue',
    testFramework: 'vitest',
    testExample: "import { mount } from '@vue/test-utils'",
  },
  react: {
    codeLanguage: 'tsx',
    testFramework: 'vitest',
    testExample: "import { render, screen } from '@testing-library/react'",
  },
  python: { codeLanguage: 'python', testFramework: 'pytest', testExample: 'def test_example():' },
  go: {
    codeLanguage: 'go',
    testFramework: 'go test',
    testExample: 'func TestExample(t *testing.T) {',
  },
  rust: {
    codeLanguage: 'rust',
    testFramework: 'cargo test',
    testExample: '#[test]\\nfn test_example() {',
  },
  node: {
    codeLanguage: 'typescript',
    testFramework: 'vitest',
    testExample: "import { expect, test } from 'vitest'",
  },
}

function validateGeneratedExercise(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!content.match(/^---\n[\s\S]*?\n---/)) {
    errors.push('Missing YAML frontmatter')
  }
  if (!content.includes('___blank_start___') || !content.includes('___blank_end___')) {
    errors.push('Missing blank markers')
  }
  if (!content.includes('## Tests')) {
    errors.push('Missing ## Tests section')
  }
  const codeBlockCount = (content.match(/```/g) || []).length
  if (codeBlockCount < 4) {
    errors.push('Missing code blocks')
  }

  return { valid: errors.length === 0, errors }
}

export async function generateExercise(options: GenerateOptions): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY']

  if (!apiKey) {
    return generatePlaceholderExercise(options)
  }

  const prompt = buildPrompt(options)
  let result = await generateWithAnthropic(prompt)

  const validation = validateGeneratedExercise(result)
  if (!validation.valid) {
    console.warn(`Generated exercise validation failed: ${validation.errors.join(', ')}`)
    const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous output had these issues: ${validation.errors.join(', ')}. Please fix them.`
    result = await generateWithAnthropic(retryPrompt)
    const retryValidation = validateGeneratedExercise(result)
    if (!retryValidation.valid) {
      console.error(
        `Generated exercise still invalid after retry: ${retryValidation.errors.join(', ')}`
      )
    }
  }

  return result
}

function buildPrompt(options: GenerateOptions): string {
  const { track, concept, difficulty, topic } = options
  const cfg = TRACK_CONFIG[track] ?? TRACK_CONFIG['typescript']!

  return `Generate a code completion exercise for learning ${track}.

Concept: ${concept}
Difficulty: ${difficulty}
${topic ? `Topic focus: ${topic}` : ''}

Requirements:
1. Create an exercise in Markdown format with YAML frontmatter
2. Include slug, title, description, difficulty, hints, and tags
3. The code should have blanks marked with ___blank_start___ and ___blank_end___
4. Include 2-4 blanks that test understanding of the concept
5. Include a Tests section with ${cfg.testFramework} tests
6. Make it educational and progressive

Format:
---
slug: ${track}-${concept.replace('-', '')}-XXX
title: Exercise Title
description: Clear description
difficulty: ${difficulty}
hints:
  - Hint 1
  - Hint 2
tags:
  - tag1
  - tag2
---

Explanation of what to do.

\`\`\`${cfg.codeLanguage}
// Code with ___blank_start___solution___blank_end___ markers
\`\`\`

## Tests

\`\`\`${cfg.codeLanguage}
${cfg.testExample}
\`\`\`
`
}

async function generateWithAnthropic(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env['ANTHROPIC_API_KEY']!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = (await response.json()) as {
    content?: Array<{ text: string }>
    error?: { type: string; message: string }
  }

  if (!response.ok || data.error) {
    throw new Error(`Anthropic API error: ${data.error?.message ?? response.statusText}`)
  }

  return data.content?.[0]?.text ?? ''
}

function generatePlaceholderExercise(options: GenerateOptions): string {
  const { track, concept, difficulty, topic } = options
  const slug = `${track}-${concept.replace(/-/g, '')}-001`
  const cfg = TRACK_CONFIG[track] ?? TRACK_CONFIG['typescript']!

  return `---
slug: ${slug}
title: ${topic ?? concept} Exercise
description: Practice ${concept} concepts in ${track}.
difficulty: ${difficulty}
hints:
  - Think about the core concept
  - Review the documentation
tags:
  - ${track}
  - ${concept}
---

Complete the following code to demonstrate your understanding of ${concept}.

\`\`\`${cfg.codeLanguage}
// TODO: Add exercise code with blanks
// Use ___blank_start___solution___blank_end___ markers
function example() {
  return ___blank_start___"hello"___blank_end___
}
\`\`\`

## Tests

\`\`\`${cfg.codeLanguage}
${cfg.testExample}

test('example works', () => {
  expect(example()).toBe('hello')
})
\`\`\`

---
Note: This is a placeholder. Set ANTHROPIC_API_KEY to generate real exercises.
`
}

export async function generateTrackScaffold(
  trackSlug: string,
  trackName: string
): Promise<TrackScaffold> {
  const apiKey = process.env['ANTHROPIC_API_KEY']

  if (!apiKey) {
    return generatePlaceholderScaffold(trackSlug, trackName)
  }

  const prompt = buildTrackPrompt(trackSlug, trackName)
  const result = await generateWithAnthropic(prompt)

  return parseTrackScaffold(result, trackSlug, trackName)
}

function buildTrackPrompt(trackSlug: string, trackName: string): string {
  return `Generate a learning track structure for "${trackName}" (slug: ${trackSlug}).

Create a logical progression of 4-6 concepts that build upon each other, from basics to advanced topics.

Output format (YAML):
---
track:
  slug: ${trackSlug}
  name: ${trackName}
  description: <2-3 sentence description>
  order: 1
  isPublished: true

concepts:
  - slug: basics
    name: Basics
    description: <1-2 sentence description>
    order: 1
  - slug: <concept-slug>
    name: <Concept Name>
    description: <1-2 sentence description>
    order: 2
  # ... more concepts
---

Rules:
- Use kebab-case for slugs
- Order concepts from beginner to advanced
- Each concept should be specific and focused
- Include practical, real-world applicable concepts
- End with advanced patterns or best practices`
}

function parseTrackScaffold(result: string, trackSlug: string, trackName: string): TrackScaffold {
  // Extract YAML content between --- markers or use the whole result
  const yamlMatch = result.match(/---\n([\s\S]*?)\n---/) || result.match(/track:\s*\n([\s\S]*)/)
  const content = yamlMatch ? yamlMatch[1] || yamlMatch[0] : result

  // Simple parsing - extract track and concepts sections
  const trackMatch = content.match(/track:\s*\n([\s\S]*?)(?=concepts:|$)/)
  const conceptsMatch = content.match(/concepts:\s*\n([\s\S]*)/)

  // Build track YAML
  let trackDescription = `Learn ${trackName} from basics to advanced patterns.`
  const descMatch = trackMatch?.[1]?.match(/description:\s*(.+)/)
  if (descMatch?.[1]) {
    trackDescription = descMatch[1].trim()
  }

  const trackYaml = `slug: ${trackSlug}
name: ${trackName}
description: ${trackDescription}
order: 1
isPublished: true
`

  // Parse concepts
  const concepts: Array<{ slug: string; yaml: string }> = []

  if (conceptsMatch?.[1]) {
    const conceptBlocks = conceptsMatch[1].split(/\n\s*-\s+slug:/).filter(Boolean)

    for (let i = 0; i < conceptBlocks.length; i++) {
      const block = conceptBlocks[i]
      if (!block) continue

      const slugMatch = block.match(/^:?\s*(\S+)/) || block.match(/slug:\s*(\S+)/)
      const nameMatch = block.match(/name:\s*(.+)/)
      const conceptDescMatch = block.match(/description:\s*(.+)/)

      if (slugMatch?.[1]) {
        const slug = slugMatch[1].replace(/^:/, '').trim()
        // Skip invalid slugs
        if (!slug || slug === '-' || slug.length < 2) continue
        const name =
          nameMatch?.[1]?.trim() ||
          slug
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        const description = conceptDescMatch?.[1]?.trim() || `Exercises for ${name}.`

        concepts.push({
          slug,
          yaml: `slug: ${slug}
name: ${name}
description: ${description}
order: ${i + 1}
isPublished: true
`,
        })
      }
    }
  }

  // Fallback if parsing failed
  if (concepts.length === 0) {
    return generatePlaceholderScaffold(trackSlug, trackName)
  }

  return { trackYaml, concepts }
}

function generatePlaceholderScaffold(trackSlug: string, trackName: string): TrackScaffold {
  return {
    trackYaml: `slug: ${trackSlug}
name: ${trackName}
description: Learn ${trackName} from basics to advanced patterns.
order: 1
isPublished: true
`,
    concepts: [
      {
        slug: 'basics',
        yaml: `slug: basics
name: Basics
description: Fundamental concepts and syntax.
order: 1
isPublished: true
`,
      },
      {
        slug: 'intermediate',
        yaml: `slug: intermediate
name: Intermediate
description: Building on the basics with more complex patterns.
order: 2
isPublished: true
`,
      },
      {
        slug: 'advanced',
        yaml: `slug: advanced
name: Advanced
description: Advanced patterns and best practices.
order: 3
isPublished: true
`,
      },
    ],
  }
}
