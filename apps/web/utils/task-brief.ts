import { extractTaskBrief } from '@blankcode/exercise-parser'

/**
 * What the exercise work surface shows above the editor.
 *
 * Reviews and challenges author the job in the markdown body. The UI calls
 * this — not a one-off formatter — so the same transform the tests drive
 * is the one the learner reads.
 */

export interface TaskBrief {
  /** Type-specific framing. Null for blanks, which keep their fill-in contract. */
  framing: string | null
  body: string
}

const FRAMING: Record<string, string> = {
  review:
    'This is recall. The code looks finished and is wrong. Find the defect and fix it. You are graded on tests you cannot see.',
  challenge:
    'Implement this from the stub. Hidden tests grade the behaviour you write, not the comments you leave.',
}

export function presentTaskBrief(input: {
  type: string
  description: string
  markdown?: string | null
  authoredBrief?: string | null
}): TaskBrief {
  if (input.type === 'blank') {
    return { framing: null, body: input.description.trim() }
  }

  const fromMarkdown = input.markdown ? extractTaskBrief(input.markdown) : ''
  const raw = (input.authoredBrief ?? '').trim() || fromMarkdown || input.description.trim()
  return {
    framing: FRAMING[input.type] ?? null,
    body: displayBrief(raw),
  }
}

/** Strip markdown chrome so the brief reads as prose on the sheet. */
function displayBrief(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
