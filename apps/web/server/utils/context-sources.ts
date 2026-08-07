import type { ContextSource } from './context-budget'

/**
 * Where a context exercise's sources come from.
 *
 * One fixture for now, keyed by nothing, so the routes are exercisable
 * end to end. The real version reads them from the exercise's markdown, which
 * is a content-format change rather than a service one — and doing it here
 * first would have meant designing the format to fit whatever these functions
 * happened to return.
 *
 * Simulated on purpose, not real MCP servers: the skill is deciding *what* the
 * model needs to see, and that lesson does not change every six months the way
 * the plumbing does. A real server would also make the exercise unreproducible
 * and put a network dependency inside grading.
 */

interface Definition {
  readonly sources: readonly ContextSource[]
  readonly required: readonly string[]
  readonly contents: Readonly<Record<string, string>>
  readonly accept: (answer: string) => boolean
}

const FIXTURE: Definition = {
  sources: [
    { id: 'schema', label: 'Table definitions', tokens: 400 },
    { id: 'sample-rows', label: 'Twenty example rows', tokens: 900 },
    { id: 'orm-docs', label: 'The whole ORM manual', tokens: 6000 },
    { id: 'slow-query-log', label: 'Yesterday of slow queries', tokens: 3000 },
  ],
  required: ['schema'],
  contents: {
    schema:
      'create table orders (id uuid primary key, customer_id uuid not null, total_cents integer not null, placed_at timestamptz not null);',
    'sample-rows': 'id,customer_id,total_cents,placed_at\n…twenty rows…',
    'orm-docs': '…six thousand tokens of manual…',
    'slow-query-log': '…yesterday of slow queries…',
  },
  accept: (answer) => /select/i.test(answer) && /orders/i.test(answer),
}

export async function sourcesFor(
  _exerciseId: string
): Promise<{ sources: readonly ContextSource[]; required: readonly string[] } | null> {
  return { sources: FIXTURE.sources, required: FIXTURE.required }
}

export async function contentFor(_exerciseId: string, sourceId: string): Promise<string> {
  return FIXTURE.contents[sourceId] ?? ''
}

export async function checkAnswer(_exerciseId: string, answer: string): Promise<boolean> {
  return FIXTURE.accept(answer)
}
