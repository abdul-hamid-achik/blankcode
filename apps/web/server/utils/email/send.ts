import { Resend } from 'resend'
import { renderEmail, renderEmailText } from './layout'
import type { Message } from './messages'

/**
 * Sending, and the one place that decides whether email is on.
 *
 * Returns rather than throws. Email is a side effect of an action, never the
 * action: a password reset whose row was written and whose message failed to
 * send is a support ticket; one that rolls back because the mail provider had a
 * bad minute is a user locked out of their own account.
 */

let client: Resend | null | undefined

function resend(): Resend | null {
  if (client !== undefined) return client
  const key = process.env['RESEND_API_KEY']
  client = key ? new Resend(key) : null
  return client
}

/**
 * Who it comes from.
 *
 * A real, monitored address rather than no-reply@. People reply to
 * transactional mail — often to say something is wrong — and throwing those
 * replies away is a way of not finding out.
 */
const FROM = 'BlankCode <hello@blankcode.dev>'

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not-configured' | 'failed' }

export async function sendEmail(to: string, message: Message): Promise<SendResult> {
  const client = resend()
  if (!client) {
    // Normal locally and in any environment without the key. Logged so a
    // missing password-reset email is findable, not silent.
    console.warn(`[email] not configured; would have sent "${message.subject}" to ${to}`)
    return { ok: false, reason: 'not-configured' }
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM,
      to,
      subject: message.subject,
      html: renderEmail(message.content),
      // Both parts, always: a message with no text alternative scores as spam
      // with most filters.
      text: renderEmailText(message.content),
    })

    if (error || !data) {
      console.error(`[email] "${message.subject}" to ${to} failed:`, error?.message ?? 'no id')
      return { ok: false, reason: 'failed' }
    }

    return { ok: true, id: data.id }
  } catch (error) {
    console.error(`[email] "${message.subject}" to ${to} threw:`, String(error))
    return { ok: false, reason: 'failed' }
  }
}
