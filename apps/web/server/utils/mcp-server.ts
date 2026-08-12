import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

/**
 * The MCP surface: ten tools, each a thin proxy onto the same API the web
 * client uses, carrying the caller's practice token. Nothing here re-decides
 * anything — redaction, the daily cap, via-labeling, and the SM-2 gate all
 * live server-side on the API routes, so an agent and a browser get exactly
 * the same product with the same rules. The tool layer's whole job is to
 * describe that product to a model well enough that it uses it properly.
 *
 * Ten on purpose: agents degrade with large tool menus, and the practice
 * loop is small — orient, pick a path, read, iterate, submit, reflect with
 * the human and record their answer, check where you stand.
 *
 * Two places this layer does shape data, both learned from watching a real
 * harness practice: list_exercises projects the catalogue down to the fields
 * its description always promised (the full payload measured ~74k tokens and
 * a session burned it twice), and submit_solution appends `reflect` —
 * questions for the agent to put to the human, because an agent that only
 * uploads solutions teaches nobody anything.
 */

interface McpContext {
  /** The raw bearer the caller presented; forwarded verbatim. */
  bearer: string
  /** Base URL for internal API calls. */
  fetcher: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>
  /**
   * Fire-and-forget ledger entry for the live feed on /connect. Only the
   * actions worth reading back: reads of an exercise, runs and submissions
   * with their verdicts, recorded reflections. Optional so tests and callers
   * without a ledger stay valid; losing an event degrades the feed, never
   * the call.
   */
  record?: (event: { tool: string; exerciseId?: string; status?: string }) => void
}

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
})

/**
 * The questions an agent should put to the human after a verdict, by exercise
 * form. Deterministic templates, not generated: they cost nothing, they are
 * always on point for the form, and the agent's own model supplies the
 * specifics from the code it just worked on. The pedagogy: a pass the human
 * cannot explain is a pass the schedule should not believe — and the agent is
 * the one person in the room who can ask.
 */
function reflectQuestions(exerciseType: string, passed: boolean): { ask: string[]; after: string } {
  const byType: Record<string, string[]> = {
    review: [
      'What class of defect was seeded here, and where would it have bitten in production?',
      'What test would you write first to make this bug impossible to reintroduce?',
    ],
    challenge: [
      'Walk me through the approach in your own words — what was the key decision?',
      'Which edge case in the suite would you have missed on your own, and why does it matter?',
    ],
    blank: [
      'Cover the answer: can you say from memory what goes in each blank, and why?',
      'This one is recall work — schedule-wise it still belongs to you. Want to redo it yourself on the site?',
    ],
    turn: ['Which turn spent the budget best, and what would you cut next time?'],
    context: ['What context did the answer actually need, and what was noise?'],
    agent: ['Which claim did you almost believe, and what evidence saved you?'],
  }
  const ask = byType[exerciseType] ?? byType['challenge']!
  return {
    ask: passed
      ? ask
      : ['What is the failing test telling us, in one sentence, before we touch the code again?'],
    after: passed
      ? 'Ask these before moving on and wait for real answers. If the human cannot answer, work the exercise again together — the pass is not the point. Recording a real answer is also what the schedule is waiting for: an agent pass with no substantive reflection keeps its review due tomorrow instead of at the earned interval.'
      : 'Get the human to state the diagnosis before iterating. Their diagnosis, not yours.',
  }
}

/**
 * Whether an initialize belongs to a different agent than the session row.
 *
 * The 30-minute merge window keys on the token, so two agents sharing one
 * token used to fold into a single row — the second initialize overwrote
 * clientName and the first agent's calls were retroactively re-attributed
 * (mcphub 0.22.0 presents `mcphub/<agent>`, which made the conflation
 * visible). A new name at initialize is a new sitting; ordinary calls carry
 * no clientInfo and can never split a session.
 */
export function isDifferentAgent(
  existingClientName: string | null,
  incomingClientName: string | undefined
): boolean {
  return (
    incomingClientName !== undefined &&
    existingClientName !== null &&
    incomingClientName !== existingClientName
  )
}

const errorText = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true as const,
})

async function proxy(ctx: McpContext, path: string, init?: { method?: string; body?: unknown }) {
  try {
    return text(await ctx.fetcher(path, init))
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode
    if (status === 429) {
      return errorText(
        'Daily submission limit reached. The cap is shared between the web editor and agents — it resets at midnight UTC, or the Pro plan raises it.'
      )
    }
    if (status === 401) {
      return errorText(
        'This practice token was revoked or is invalid. Mint a new one at blankcode.dev/connect.'
      )
    }
    return errorText(`The API refused: ${status ?? 'network error'}. ${String(error)}`)
  }
}

export function buildPracticeServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: 'blankcode', version: '1.0.0' },
    {
      instructions: [
        'BlankCode is coding practice with real execution: exercises are graded by running their test suite in a sandbox.',
        'You are practicing on behalf of the human whose token you carry. Call whoami first to confirm whose work this is.',
        'Recall exercises (type "blank") that you complete are recorded as assisted and do NOT advance the human\'s review schedule — their memory is theirs to train. The vibecoding forms (challenge, review) count fully; working through an agent is their curriculum.',
        'Iterate with run_tests (feedback, nothing recorded), then submit_solution when green (the verdict of record). Each has its own daily budget on free accounts.',
        'Never claim a pass you did not get from submit_solution. The verdict comes from the sandbox, not from you.',
        'list_paths gives the curated sequences — the natural shape of a session is walking one with the human.',
        "After every verdict, submit_solution returns `reflect` questions. Ask them, wait for the human's answers, and record them verbatim with record_reflection before the next exercise: their learning is the product, your throughput is not.",
      ].join('\n'),
    }
  )

  server.registerTool(
    'whoami',
    {
      title: 'Who am I practicing as',
      description:
        'The account this token belongs to, and the token kind. Call this first in a session.',
      inputSchema: {},
    },
    () => proxy(ctx, '/api/auth/me')
  )

  server.registerTool(
    'list_tracks',
    {
      title: 'List tracks',
      description: 'The six language tracks with their concepts.',
      inputSchema: {},
    },
    () => proxy(ctx, '/api/tracks')
  )

  server.registerTool(
    'list_exercises',
    {
      title: 'List exercises',
      description:
        'The catalogue, compact: id, slug, title, type, difficulty, conceptId per exercise. Optionally filter by track slug and/or type. Types: blank (fill the gaps — recall, assisted-labeled for agents), challenge (implement against hidden tests), review (find the defect; the suite is hidden), turn/context (session forms). Fetch full detail with get_exercise.',
      inputSchema: {
        track: z
          .string()
          .optional()
          .describe('A track slug from list_tracks (e.g. "typescript") to limit the list'),
        type: z
          .enum(['blank', 'challenge', 'review', 'turn', 'context'])
          .optional()
          .describe('Limit to one exercise type'),
      },
    },
    async ({ track, type }) => {
      try {
        interface ExerciseRow {
          id: string
          slug: string
          title: string
          type: string
          difficulty: string
          conceptId: string
        }
        const all = (await ctx.fetcher('/api/exercises')) as ExerciseRow[]
        let rows = all
        if (track) {
          const trackDetail = (await ctx.fetcher(`/api/tracks/${encodeURIComponent(track)}`)) as {
            concepts?: Array<{ id: string }>
          }
          const conceptIds = new Set((trackDetail.concepts ?? []).map((concept) => concept.id))
          rows = rows.filter((exercise) => conceptIds.has(exercise.conceptId))
        }
        if (type) rows = rows.filter((exercise) => exercise.type === type)
        // The projection the description promises. The raw rows carry starter
        // code and full descriptions — measured at ~74k tokens for the whole
        // catalogue, which is a context bomb, not a listing.
        return text(
          rows.map(({ id, slug, title, type: exerciseType, difficulty, conceptId }) => ({
            id,
            slug,
            title,
            type: exerciseType,
            difficulty,
            conceptId,
          }))
        )
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode
        return errorText(`The API refused: ${status ?? 'network error'}. ${String(error)}`)
      }
    }
  )

  server.registerTool(
    'list_paths',
    {
      title: 'List learning paths',
      description:
        'The curated sequences — each path is a course an agent can walk with the human: slug, name, description, and exerciseIds in the intended order. Fetch each with get_exercise, work through them in order.',
      inputSchema: {},
    },
    async () => {
      try {
        interface PathRow {
          slug: string
          name: string
          description: string
          challengeIds: string[]
        }
        const paths = (await ctx.fetcher('/api/paths')) as PathRow[]
        return text(
          paths.map(({ slug, name, description, challengeIds }) => ({
            slug,
            name,
            description,
            exerciseIds: challengeIds,
          }))
        )
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode
        return errorText(`The API refused: ${status ?? 'network error'}. ${String(error)}`)
      }
    }
  )

  server.registerTool(
    'get_exercise',
    {
      title: 'Get an exercise',
      description:
        'One exercise by id: description, starter code, hints, blanks (positions only). Solutions and hidden test suites never leave the server — grade by submitting.',
      inputSchema: { id: z.string().describe('The exercise UUID from list_exercises') },
    },
    ({ id }) => {
      ctx.record?.({ tool: 'get_exercise', exerciseId: id })
      return proxy(ctx, `/api/exercises/${encodeURIComponent(id)}`)
    }
  )

  server.registerTool(
    'run_tests',
    {
      title: 'Run the tests without submitting',
      description:
        "The iterate step: executes the code against the exercise's real test suite in a sandbox and returns per-test results, WITHOUT creating a submission — nothing lands on progress, the dashboard, or the review schedule. Use this to check work in progress; when it passes, make it count with submit_solution. Free accounts get their own daily run budget, separate from submissions; the response includes runsRemainingToday (null means unmetered or unknown).",
      inputSchema: {
        exerciseId: z.string().describe('The exercise UUID'),
        code: z.string().max(50_000).describe('The complete solution code to run'),
      },
    },
    async ({ exerciseId, code }) => {
      const result = await proxy(ctx, '/api/submissions/run', {
        method: 'POST',
        body: { exerciseId, code },
      })
      try {
        const outcome = JSON.parse(
          'isError' in result ? '{}' : (result.content[0]?.text ?? '{}')
        ) as { status?: string }
        ctx.record?.({ tool: 'run_tests', exerciseId, status: outcome.status })
      } catch {
        ctx.record?.({ tool: 'run_tests', exerciseId })
      }
      return result
    }
  )

  server.registerTool(
    'submit_solution',
    {
      title: 'Submit a solution',
      description:
        "Runs the code against the exercise's real test suite in a sandbox and returns the verdict. This is the only source of truth about passing. Counts against the account's shared daily limit. The response includes `reflect`: questions to put to the human before moving on — ask them and wait for real answers; the human's learning is the product, not the pass.",
      inputSchema: {
        exerciseId: z.string().describe('The exercise UUID'),
        code: z.string().max(50_000).describe('The complete solution code'),
      },
    },
    async ({ exerciseId, code }) => {
      const result = await proxy(ctx, '/api/submissions', {
        method: 'POST',
        body: { exerciseId, code },
      })
      if ('isError' in result) return result
      // Append the reflection step. An agent that only uploads solutions
      // teaches nobody anything; the questions give it something to do with
      // the human at exactly the moment the verdict makes them concrete.
      // Fail-open: a submission verdict must never be lost to a coaching
      // garnish.
      try {
        const submission = JSON.parse(result.content[0]?.text ?? '{}') as { status?: string }
        ctx.record?.({ tool: 'submit_solution', exerciseId, status: submission.status })
        const exercise = (await ctx.fetcher(
          `/api/exercises/${encodeURIComponent(exerciseId)}`
        )) as {
          type?: string
          title?: string
        }
        return text({
          ...submission,
          reflect: reflectQuestions(exercise.type ?? 'challenge', submission.status === 'passed'),
        })
      } catch {
        return result
      }
    }
  )

  server.registerTool(
    'record_reflection',
    {
      title: "Record the human's reflection",
      description:
        "After asking the reflect questions, record the human's answer VERBATIM — their words, not your paraphrase. The answer lands on their exercise page and dashboard as the record of what they could explain. Record one entry per question answered. Do not answer for them, and do not record silence as an answer.",
      inputSchema: {
        exerciseId: z.string().describe('The exercise UUID the reflection is about'),
        question: z.string().max(1000).describe('The question as you asked it'),
        answer: z.string().max(10_000).describe("The human's answer, verbatim"),
      },
    },
    ({ exerciseId, question, answer }) => {
      ctx.record?.({ tool: 'record_reflection', exerciseId })
      return proxy(ctx, '/api/reflections', {
        method: 'POST',
        body: { exerciseId, question, answer },
      })
    }
  )

  server.registerTool(
    'get_progress',
    {
      title: 'Get progress',
      description: "The human's progress per track: completed counts and concept mastery.",
      inputSchema: {},
    },
    () => proxy(ctx, '/api/progress/summary')
  )

  server.registerTool(
    'get_due_reviews',
    {
      title: 'Get due reviews',
      description:
        'Exercises the spaced-repetition schedule says are due now. NOTE: these are recall work that belongs to the human. Surface them ("3 reviews are due — want to do them together?") rather than doing them yourself: an agent pass on a blank exercise leaves the review still owed.',
      inputSchema: {},
    },
    () => proxy(ctx, '/api/reviews/due')
  )

  // ── Prompts and resources ─────────────────────────────────────────────────
  // The /connect page asks people to copy a course prompt and download a
  // skill file. A harness that speaks MCP can discover both right here
  // instead: prompts/list surfaces the session shape, resources/read hands
  // over the etiquette. Same content, zero copy-paste.

  server.registerPrompt(
    'walk-a-path',
    {
      title: 'Walk a learning path with the human',
      description:
        'The canonical session: pick a path, work it in order, iterate with run_tests, submit when believed in, and reflect with the human after every verdict.',
      argsSchema: {
        path: z
          .string()
          .optional()
          .describe('A path slug from list_paths; omit to let the human choose'),
      },
    },
    ({ path }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'Connect to BlankCode. Call whoami first.',
              path
                ? `Walk the '${path}' path in order.`
                : 'Call list_paths and let me pick one, then walk it in order.',
              'For each exercise: fetch it, discuss the approach with me before anything is submitted, iterate with run_tests (it records nothing), and only call submit_solution when we believe in it.',
              'After every verdict, ask me the reflect questions it returns, wait for my answers, and record them verbatim with record_reflection. If I cannot explain the pass, we redo the exercise together.',
              'Never claim a pass the sandbox did not return.',
            ].join(' '),
          },
        },
      ],
    })
  )

  server.registerResource(
    'practice-skill',
    'blankcode://skill/practice',
    {
      title: 'BlankCode practice skill',
      description: 'The etiquette in full: the loop, the honesty rules, the limits.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      // The markdown ships to browsers as a public asset and to this handler
      // as a Nitro server asset (see nuxt.config): internal $fetch cannot
      // reach public files — it routes into the app instead of the asset.
      const skill = await useStorage('assets:skills')
        .getItem<string>('blankcode-practice.md')
        .catch(() => null)
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text:
              (typeof skill === 'string' && skill.length > 0 && skill) ||
              'The skill file could not be loaded — read it at https://blankcode.dev/skills/blankcode-practice.md',
          },
        ],
      }
    }
  )

  return server
}
