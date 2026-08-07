/**
 * The shell every email shares.
 *
 * Tables and inline styles, not the site's CSS. Email clients are a decade
 * behind a browser — Outlook renders through Word, Gmail strips `<style>` in
 * some contexts — so the design system is reproduced here as literal values
 * rather than imported. The duplication is the price of the medium.
 *
 * The palette matches `assets/css/main.css` in its light form. Dark mode is
 * deliberately not attempted: `prefers-color-scheme` support is uneven enough
 * that the usual result is black text on a black background for someone.
 */

const INK = '#111318'
const MUTED = '#5b6270'
const RULE = '#e3e6ea'
const SIGNAL = '#d94f2b'
const PAPER = '#fbfbfd'

export interface EmailAction {
  readonly label: string
  readonly url: string
}

export interface EmailContent {
  /** Shown in the client's inbox list, after the subject. */
  readonly preheader: string
  readonly heading: string
  /** Each becomes its own paragraph. Plain text; no markup is interpolated. */
  readonly paragraphs: readonly string[]
  readonly action?: EmailAction
  /** Small print under the rule. The unsubscribe line goes here. */
  readonly footnote?: string
}

/** Escapes anything that reaches the template from a person or the database. */
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderEmail(content: EmailContent): string {
  const paragraphs = content.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK}">${escape(text)}</p>`
    )
    .join('')

  const action = content.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
         <tr><td style="background:${INK};border-radius:4px">
           <a href="${escape(content.action.url)}"
              style="display:inline-block;padding:12px 22px;font-family:'IBM Plex Sans',-apple-system,Segoe UI,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${escape(content.action.label)}</a>
         </td></tr>
       </table>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${MUTED}">
         If the button does not work, paste this into your browser:<br>
         <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;word-break:break-all">${escape(content.action.url)}</span>
       </p>`
    : ''

  const footnote = content.footnote
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">${escape(content.footnote)}</p>`
    : ''

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escape(content.heading)}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
  <!-- Shown next to the subject in most inboxes, then hidden. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(content.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#ffffff;border:1px solid ${RULE};border-radius:6px">
        <tr><td style="padding:28px 28px 0">
          <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:15px;font-weight:600;color:${INK}">blank</span><span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:15px;font-weight:600;color:${SIGNAL}">code</span>
        </td></tr>
        <tr><td style="padding:20px 28px 28px;font-family:'IBM Plex Sans',-apple-system,Segoe UI,sans-serif">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:600;color:${INK}">${escape(content.heading)}</h1>
          ${paragraphs}
          ${action}
        </td></tr>
        ${
          footnote
            ? `<tr><td style="padding:0 28px 24px;border-top:1px solid ${RULE};font-family:'IBM Plex Sans',-apple-system,Segoe UI,sans-serif">
                 <div style="padding-top:16px">${footnote}</div>
               </td></tr>`
            : ''
        }
      </table>
    </td></tr>
  </table>
</body></html>`
}

/**
 * The plain-text alternative.
 *
 * Not optional. A message with no text part scores as spam with most filters,
 * and some people read mail in a client that shows nothing else.
 */
export function renderEmailText(content: EmailContent): string {
  const lines = [content.heading, '', ...content.paragraphs.flatMap((p) => [p, ''])]
  if (content.action) lines.push(`${content.action.label}: ${content.action.url}`, '')
  if (content.footnote) lines.push('—', content.footnote)
  return lines.join('\n')
}
