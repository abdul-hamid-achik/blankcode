import { describe, expect, it } from 'vitest'
import { renderEmail, renderEmailText } from '../server/utils/email/layout'
import {
  emailChanged,
  passwordReset,
  reviewsDue,
  subscriptionEnding,
  subscriptionStarted,
  welcome,
} from '../server/utils/email/messages'

const ALL = [
  passwordReset('https://blankcode.dev/reset?token=abc', 30),
  welcome('https://blankcode.dev/tracks'),
  reviewsDue(3, 'https://blankcode.dev/review'),
  emailChanged('new@example.com', 'https://blankcode.dev/settings'),
  subscriptionStarted('1 September', 'https://blankcode.dev/settings'),
  subscriptionEnding('1 September', 'https://blankcode.dev/settings'),
]

describe('every message', () => {
  it('has a subject that says what happened', () => {
    for (const message of ALL) {
      expect(message.subject.length).toBeGreaterThan(0)
      // Long subjects are truncated in the inbox, which is where the reader
      // decides whether to open it.
      expect(message.subject.length).toBeLessThanOrEqual(60)
    }
  })

  it('has a preheader, so the inbox preview is not the first line of body text', () => {
    for (const message of ALL) {
      expect(message.content.preheader.length).toBeGreaterThan(0)
    }
  })

  it('renders both an HTML and a text part', () => {
    // A message with no text alternative scores as spam with most filters.
    for (const message of ALL) {
      expect(renderEmail(message.content)).toContain('<!doctype html>')
      expect(renderEmailText(message.content).trim().length).toBeGreaterThan(0)
    }
  })

  it('keeps the voice: no urgency, no exclamation marks', () => {
    for (const message of ALL) {
      const prose = [message.subject, ...message.content.paragraphs].join(' ')
      expect(prose).not.toContain('!')
      expect(prose.toLowerCase()).not.toMatch(/\b(hurry|act now|don't miss|last chance)\b/)
    }
  })
})

describe('renderEmail', () => {
  it('escapes anything that came from a person', () => {
    // A display name or an email address reaches these templates. One that
    // contains markup must not become markup.
    const html = renderEmail({
      preheader: 'x',
      heading: 'Hello <script>alert(1)</script>',
      paragraphs: ['Address: <b>a@b.c</b>'],
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;b&gt;')
  })

  it('escapes the action URL too', () => {
    const html = renderEmail({
      preheader: 'x',
      heading: 'x',
      paragraphs: [],
      action: { label: 'Go', url: 'https://blankcode.dev/?a=1&b="2"' },
    })
    expect(html).toContain('&amp;b=')
    expect(html).not.toContain('b="2"')
  })

  it('shows the link as text as well as a button', () => {
    // Buttons are stripped or unclickable in enough clients that the raw URL
    // has to be there.
    const url = 'https://blankcode.dev/reset?token=abc'
    const html = renderEmail({
      preheader: 'x',
      heading: 'x',
      paragraphs: [],
      action: { label: 'Reset', url },
    })
    expect(html.split(url).length - 1).toBeGreaterThanOrEqual(2)
  })
})

describe('reviewsDue', () => {
  it('writes one exercise in the singular', () => {
    // "1 exercises" is the detail that makes mail look automated in the way
    // people stop opening.
    const message = reviewsDue(1, 'https://blankcode.dev/review')
    expect(message.subject).toBe('One exercise is due')
    expect(message.content.heading).toContain('one exercise')
  })

  it('uses the plural for more than one', () => {
    expect(reviewsDue(4, 'https://blankcode.dev/review').subject).toBe('4 exercises are due')
  })

  it('says how to stop receiving them', () => {
    expect(reviewsDue(2, 'x').content.footnote).toMatch(/settings/i)
  })
})

describe('passwordReset', () => {
  it('states how long the link lasts, in the body and the preheader', () => {
    const message = passwordReset('https://blankcode.dev/reset', 30)
    expect(message.content.preheader).toContain('30')
    expect(message.content.paragraphs.join(' ')).toContain('30 minutes')
  })

  it('tells someone who did not ask what to do, rather than to ignore it', () => {
    const prose = passwordReset('x', 30).content.paragraphs.join(' ').toLowerCase()
    expect(prose).toContain('not you')
    expect(prose).not.toContain('ignore this email')
  })
})
