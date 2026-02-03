import type { Difficulty } from '@blankcode/shared'

export interface GenerateOptions {
  track: string
  concept: string
  difficulty: Difficulty
  topic?: string
}

export async function generateExercise(options: GenerateOptions): Promise<string> {
  const { track, concept, difficulty, topic } = options

  const apiKey = process.env['OPENAI_API_KEY'] ?? process.env['ANTHROPIC_API_KEY']

  if (!apiKey) {
    return generatePlaceholderExercise(options)
  }

  const prompt = buildPrompt(options)

  if (process.env['ANTHROPIC_API_KEY']) {
    return generateWithAnthropic(prompt)
  }

  return generateWithOpenAI(prompt)
}

function buildPrompt(options: GenerateOptions): string {
  const { track, concept, difficulty, topic } = options

  return `Generate a code completion exercise for learning ${track}.

Concept: ${concept}
Difficulty: ${difficulty}
${topic ? `Topic focus: ${topic}` : ''}

Requirements:
1. Create an exercise in Markdown format with YAML frontmatter
2. Include slug, title, description, difficulty, hints, and tags
3. The code should have blanks marked with ___blank_start___ and ___blank_end___
4. Include 2-4 blanks that test understanding of the concept
5. Include a Tests section with vitest tests
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

\`\`\`typescript
// Code with ___blank_start___solution___blank_end___ markers
\`\`\`

## Tests

\`\`\`typescript
// Vitest tests
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
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  return (data as { content: Array<{ text: string }> }).content[0]?.text ?? ''
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env['OPENAI_API_KEY']}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    }),
  })

  const data = await response.json()
  return (
    (data as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content ??
    ''
  )
}

function generatePlaceholderExercise(options: GenerateOptions): string {
  const { track, concept, difficulty, topic } = options
  const slug = `${track}-${concept.replace(/-/g, '')}-001`

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

\`\`\`typescript
// TODO: Add exercise code with blanks
// Use ___blank_start___solution___blank_end___ markers
function example() {
  return ___blank_start___"hello"___blank_end___
}
\`\`\`

## Tests

\`\`\`typescript
import { expect, test } from 'vitest'

test('example works', () => {
  expect(example()).toBe('hello')
})
\`\`\`

---
Note: This is a placeholder. Set OPENAI_API_KEY or ANTHROPIC_API_KEY to generate real exercises.
`
}
