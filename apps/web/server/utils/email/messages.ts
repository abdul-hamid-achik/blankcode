import { type EmailContent } from './layout'

/**
 * Every message the product sends, as data.
 *
 * One file so the whole voice can be read at once, and so adding a message is a
 * visible diff rather than a string appearing somewhere in a handler. The
 * copy follows AGENTS.md: statements, no urgency, no exclamation marks, and it
 * says what happened and what to do about it.
 */

export interface Message {
  readonly subject: string
  readonly content: EmailContent
}

export function passwordReset(url: string, minutes: number): Message {
  return {
    subject: 'Reset your BlankCode password',
    content: {
      preheader: `The link works for ${minutes} minutes.`,
      heading: 'Reset your password',
      paragraphs: [
        `Someone asked to reset the password for this account. The link below works for ${minutes} minutes and once only.`,
        // Named plainly rather than "if this wasn't you, ignore this email".
        // Someone who did not ask should be told what to do, not reassured.
        'If that was not you, nothing has changed yet and you can close this. If you get these repeatedly, change your password from a session you trust.',
      ],
      action: { label: 'Choose a new password', url },
      footnote: 'BlankCode · blankcode.dev',
    },
  }
}

export function welcome(url: string): Message {
  return {
    subject: 'Your BlankCode account',
    content: {
      preheader: 'Pick a track and fill in the first blank.',
      heading: 'Your account is ready',
      paragraphs: [
        'BlankCode gives you code that is almost finished and asks for the missing pieces. The exercise’s real test suite runs in an isolated sandbox and tells you immediately whether you were right.',
        'Start anywhere. Exercises you finish come back later, spaced out, before you would have forgotten them.',
      ],
      action: { label: 'Pick a track', url },
      footnote: 'You are getting this because you created an account at blankcode.dev.',
    },
  }
}

export function reviewsDue(count: number, url: string): Message {
  // Singular and plural written out. "1 exercises" is the detail that makes an
  // email look automated in the way people stop opening.
  const what = count === 1 ? 'one exercise' : `${count} exercises`
  return {
    subject: count === 1 ? 'One exercise is due' : `${count} exercises are due`,
    content: {
      preheader: 'Spaced repetition works when the review actually happens.',
      heading: `${what} came back around`,
      paragraphs: [
        `You finished ${what} a while ago, and the schedule says now is when recalling it is worth the most.`,
        'This takes a few minutes. If now is not the moment, it will still be there tomorrow.',
      ],
      action: { label: 'Start reviewing', url },
      footnote: 'Turn these off in your settings at any time.',
    },
  }
}

export function emailChanged(newAddress: string, url: string): Message {
  return {
    subject: 'The email on your BlankCode account changed',
    content: {
      preheader: 'Sent to the old address so a takeover cannot happen silently.',
      heading: 'Your email address was changed',
      paragraphs: [
        `The account now uses ${newAddress}. This notice goes to the previous address, which is the point: an account takeover that changes the email should not be silent to the person who owned it.`,
        'If you did not do this, use the link below to lock the account and reset your password.',
      ],
      action: { label: 'I did not do this', url },
      footnote: 'BlankCode · blankcode.dev',
    },
  }
}

export function subscriptionStarted(renewsOn: string, url: string): Message {
  return {
    subject: 'Your BlankCode subscription is active',
    content: {
      preheader: `Renews ${renewsOn}. Cancel any time.`,
      heading: 'Subscription active',
      paragraphs: [
        `The daily submission limit is gone. It renews on ${renewsOn}, and cancelling stops the renewal without taking away the days you already paid for.`,
      ],
      action: { label: 'Manage your subscription', url },
      footnote: 'BlankCode · blankcode.dev',
    },
  }
}

export function subscriptionEnding(endsOn: string, url: string): Message {
  return {
    subject: 'Your BlankCode subscription ends soon',
    content: {
      preheader: `Access continues until ${endsOn}.`,
      heading: 'Your subscription will not renew',
      paragraphs: [
        `Everything keeps working until ${endsOn} — those days were paid for. After that the account goes back to the free limits, and nothing you have done is lost.`,
      ],
      action: { label: 'Resume it', url },
      footnote: 'BlankCode · blankcode.dev',
    },
  }
}
