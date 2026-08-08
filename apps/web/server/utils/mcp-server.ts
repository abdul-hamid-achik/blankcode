import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

/**
 * The MCP surface: seven tools, each a thin proxy onto the same API the web
 * client uses, carrying the caller's practice token. Nothing here re-decides
 * anything — redaction, the daily cap, via-labeling, and the SM-2 gate all
 * live server-side on the API routes, so an agent and a browser get exactly
 * the same product with the same rules. The tool layer's whole job is to
 * describe that product to a model well enough that it uses it properly.
 *
 * Eight on purpose: agents degrade with large tool menus, and the practice
 * loop is small — orient, pick, read, iterate, submit, check where you stand.
 */

interface McpContext {
  /** The raw bearer the caller presented; forwarded verbatim. */
  bearer: string
  /** Base URL for internal API calls. */
  fetcher: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>
}

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
})

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
        'Every published exercise: id, slug, title, type, difficulty. Filter client-side; the catalogue is small. Types: blank (fill the gaps — recall, assisted-labeled for agents), challenge (implement against hidden tests), review (find the defect; the suite is hidden).',
      inputSchema: {},
    },
    () => proxy(ctx, '/api/exercises')
  )

  server.registerTool(
    'get_exercise',
    {
      title: 'Get an exercise',
      description:
        'One exercise by id: description, starter code, hints, blanks (positions only). Solutions and hidden test suites never leave the server — grade by submitting.',
      inputSchema: { id: z.string().describe('The exercise UUID from list_exercises') },
    },
    ({ id }) => proxy(ctx, `/api/exercises/${encodeURIComponent(id)}`)
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
    ({ exerciseId, code }) =>
      proxy(ctx, '/api/submissions/run', { method: 'POST', body: { exerciseId, code } })
  )

  server.registerTool(
    'submit_solution',
    {
      title: 'Submit a solution',
      description:
        "Runs the code against the exercise's real test suite in a sandbox and returns the verdict. This is the only source of truth about passing. Counts against the account's shared daily limit.",
      inputSchema: {
        exerciseId: z.string().describe('The exercise UUID'),
        code: z.string().max(50_000).describe('The complete solution code'),
      },
    },
    ({ exerciseId, code }) =>
      proxy(ctx, '/api/submissions', { method: 'POST', body: { exerciseId, code } })
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

  return server
}
