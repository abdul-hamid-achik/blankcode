import { streamText } from 'ai'

const MODEL = process.env['LLM_MODEL'] ?? 'deepseek/deepseek-v4-flash'

/**
 * The model's reply for a turn. The only part of this feature needing a key.
 *
 * Isolated in its own module so the flow around it can be imported and tested
 * without pulling the gateway in, and imported lazily by the route so a missing
 * key is a 503 rather than a module-load failure.
 */
export async function generateReply(
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const result = streamText({
    model: MODEL,
    system: [
      'You are helping someone build a small piece of software. They have a',
      'strictly limited number of messages, so answer the message you were',
      'given rather than asking what they meant.',
      '',
      'Reply with the code and one or two sentences about what you changed.',
    ].join('\n'),
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    providerOptions: {
      // Its own tag: this feature is conversation turns, not a two-paragraph
      // explanation, and its cost has to be separable on the bill.
      gateway: { tags: ['app:blankcode', 'feature:turn-budget'] },
    },
  })

  return await result.text
}
