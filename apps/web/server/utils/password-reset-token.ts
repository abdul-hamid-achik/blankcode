import * as jose from 'jose'
import {
  isResetClaims,
  RESET_MINUTES,
  RESET_PURPOSE,
  type ResetClaims,
} from '~/utils/password-reset'

function secret(): Uint8Array {
  const value = process.env['JWT_SECRET']
  if (!value) throw createError({ statusCode: 503, statusMessage: 'Auth is not configured' })
  return new TextEncoder().encode(value)
}

export async function signResetToken(userId: string, email: string): Promise<string> {
  return new jose.SignJWT({ email, purpose: RESET_PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${RESET_MINUTES}m`)
    .sign(secret())
}

export async function verifyResetToken(token: string): Promise<ResetClaims> {
  try {
    const verified = await jose.jwtVerify(token, secret())
    const payload = { ...verified.payload, sub: verified.payload.sub }
    if (!isResetClaims(payload)) throw new Error('wrong purpose')
    return payload
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'This reset link is invalid or has expired. Request a new one.',
    })
  }
}
