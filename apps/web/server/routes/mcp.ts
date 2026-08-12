import { createDatabaseFromEnv } from '@blankcode/db/client'
import { agentEvents, apiTokens, harnessSessions } from '@blankcode/db/schema'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { buildPracticeServer, isDifferentAgent } from '~/server/utils/mcp-server'
import { hashPracticeToken, isPracticeToken } from '~/server/utils/practice-tokens'

/**
 * The MCP endpoint: `https://blankcode.dev/mcp`.
 *
 * Stateless streamable HTTP — a fresh server instance per request, because
 * that is the one MCP mode that behaves in serverless, and every fact that
 * matters lives in Postgres anyway. GET (the SSE channel) and DELETE (session
 * teardown) are refused: with no session there is nothing to stream or tear
 * down, and saying 405 plainly beats holding a connection that will never
 * speak.
 *
 * Auth is a practice token only. A web JWT is refused here on purpose: the
 * session belongs in a browser, and an agent should never be holding one.
 */

/** One practice sitting: tool calls closer together than this share a session. */
const SESSION_WINDOW_MS = 30 * 60 * 1000

/** A wall against runaway loops, not a quota — the daily cap guards spend. */
const MAX_CALLS_PER_WINDOW = 2000

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    setResponseHeader(event, 'Allow', 'POST')
    throw createError({
      statusCode: 405,
      statusMessage: 'This MCP server is stateless: POST only.',
    })
  }

  // ── Authentication ──────────────────────────────────────────────────────
  const authorization = getHeader(event, 'authorization') ?? ''
  const bearer = authorization.replace(/^Bearer\s+/i, '')

  if (!bearer || !isPracticeToken(bearer)) {
    setResponseHeader(event, 'WWW-Authenticate', 'Bearer realm="blankcode", charset="UTF-8"')
    throw createError({
      statusCode: 401,
      statusMessage:
        'A practice token is required (Authorization: Bearer bck_…). Mint one at blankcode.dev/connect.',
    })
  }

  const db = createDatabaseFromEnv()
  const tokenRow = await db.query.apiTokens.findFirst({
    where: and(eq(apiTokens.token, await hashPracticeToken(bearer)), isNull(apiTokens.revokedAt)),
    columns: { id: true, userId: true },
  })

  if (!tokenRow) {
    setResponseHeader(event, 'WWW-Authenticate', 'Bearer realm="blankcode", charset="UTF-8"')
    throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked practice token.' })
  }

  const body = await readBody(event)

  // ── The implicit session ────────────────────────────────────────────────
  // Upserted per call, never client-declared: a session an agent reports is
  // a claim, and agents are bad bookkeepers. clientInfo is captured from the
  // initialize request when one happens to open the window.
  const clientInfo =
    body?.method === 'initialize'
      ? (body?.params?.clientInfo as { name?: string; version?: string } | undefined)
      : undefined

  /*
   * The wall is checked BEFORE the window is touched. The review found the
   * old order incremented toolCalls and refreshed lastSeenAt first, then
   * 429'd — so every rejected retry re-armed the 30-minute window and the
   * "resets in 30 minutes" promise was false: only total silence recovered
   * a session. A rejected call now leaves the row exactly as it found it.
   */
  const windowStart = new Date(Date.now() - SESSION_WINDOW_MS)
  const found = await db.query.harnessSessions.findFirst({
    where: and(
      eq(harnessSessions.apiTokenId, tokenRow.id),
      gt(harnessSessions.lastSeenAt, windowStart)
    ),
    columns: { id: true, toolCalls: true, clientName: true },
  })

  /*
   * A different agent initializing inside the window is a new sitting, not a
   * continuation: before this split, the second agent's initialize
   * overwrote clientName and inherited the first agent's call count, which
   * re-attributed history and could 429 a fresh session on arrival.
   */
  const existing = found && !isDifferentAgent(found.clientName, clientInfo?.name) ? found : null

  if (existing && existing.toolCalls >= MAX_CALLS_PER_WINDOW) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many calls this session. Take a breath; the window resets in 30 minutes.',
    })
  }

  if (existing) {
    await db
      .update(harnessSessions)
      .set({
        lastSeenAt: new Date(),
        toolCalls: sql`${harnessSessions.toolCalls} + 1`,
        ...(clientInfo?.name ? { clientName: clientInfo.name } : {}),
        ...(clientInfo?.version ? { clientVersion: clientInfo.version } : {}),
      })
      .where(eq(harnessSessions.id, existing.id))
  } else {
    await db.insert(harnessSessions).values({
      userId: tokenRow.userId,
      apiTokenId: tokenRow.id,
      clientName: clientInfo?.name ?? null,
      clientVersion: clientInfo?.version ?? null,
      toolCalls: 1,
    })
  }

  // ── Serve ───────────────────────────────────────────────────────────────
  // Tools proxy onto the same API the browser uses, presenting the caller's
  // own token — so the practice-scope allowlist, redaction, the daily cap,
  // via-labeling, and the SM-2 gate all apply identically. One product.
  // Cast once: Nitro's typed $fetch tries to infer the route union from a
  // dynamic string and blows the type-checker's stack. These are internal
  // calls to our own API; the response types are owned by the API schemas.
  const internalFetch = $fetch as unknown as (
    path: string,
    opts?: Record<string, unknown>
  ) => Promise<unknown>

  const server = buildPracticeServer({
    bearer,
    fetcher: (path, init) =>
      internalFetch(path, {
        method: init?.method ?? 'GET',
        headers: { Authorization: `Bearer ${bearer}` },
        ...(init?.body !== undefined ? { body: init.body } : {}),
      }),
    // The live-feed ledger, fire-and-forget: a lost row degrades the feed on
    // /connect, never the tool call that was being made.
    record: (entry) => {
      void db
        .insert(agentEvents)
        .values({
          userId: tokenRow.userId,
          apiTokenId: tokenRow.id,
          tool: entry.tool,
          exerciseId: entry.exerciseId ?? null,
          status: entry.status ?? null,
        })
        .catch(() => {})
    },
  })

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  event.node.res.on('close', () => {
    void transport.close()
    void server.close()
  })

  await server.connect(transport)
  await transport.handleRequest(event.node.req, event.node.res, body)
})
