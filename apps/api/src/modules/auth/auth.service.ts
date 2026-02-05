import { refreshTokens, users } from '@blankcode/db/schema'
import type { UserCreateInput, UserLoginInput } from '@blankcode/shared'
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { type Database, DRIZZLE } from '../../database/drizzle.provider.js'

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private db: Database,
    @Inject(JwtService) private jwtService: JwtService
  ) {}

  async register(input: UserCreateInput) {
    const existingUser = await this.db.query.users.findFirst({
      where: eq(users.email, input.email),
    })

    if (existingUser) {
      throw new ConflictException('User with this email already exists')
    }

    const existingUsername = await this.db.query.users.findFirst({
      where: eq(users.username, input.username),
    })

    if (existingUsername) {
      throw new ConflictException('Username is already taken')
    }

    const passwordHash = await bcrypt.hash(input.password, 12)

    const [user] = await this.db
      .insert(users)
      .values({
        email: input.email,
        username: input.username,
        passwordHash,
        displayName: input.displayName ?? null,
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
      })

    if (!user) {
      throw new Error('Failed to create user')
    }

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email })
    const refreshTokenResult = await this.generateRefreshToken(user.id)

    return {
      user,
      accessToken,
      refreshToken: refreshTokenResult.token,
      refreshTokenExpiresAt: refreshTokenResult.expiresAt,
    }
  }

  async login(input: UserLoginInput) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, input.email),
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash)

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email })
    const refreshTokenResult = await this.generateRefreshToken(user.id)

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      accessToken,
      refreshToken: refreshTokenResult.token,
      refreshTokenExpiresAt: refreshTokenResult.expiresAt,
    }
  }

  async validateUser(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    })

    return user ?? null
  }

  private async generateRefreshToken(userId: string) {
    const token = crypto.randomBytes(64).toString('hex')
    const tokenHash = await bcrypt.hash(token, 10)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await this.db.insert(refreshTokens).values({
      userId,
      token: '',
      tokenHash,
      expiresAt,
    })

    return { token, expiresAt }
  }

  async validateAndRotateRefreshToken(token: string): Promise<{
    user: { id: string; email: string; username: string; displayName: string | null }
    accessToken: string
    refreshToken: string
    refreshTokenExpiresAt: Date
  }> {
    const tokenRecord = await this.db.query.refreshTokens.findFirst({
      where: and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())),
      with: {
        user: true,
      },
    })

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const isValid = await bcrypt.compare(token, tokenRecord.tokenHash)
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, tokenRecord.id))

    const accessToken = this.jwtService.sign({
      sub: tokenRecord.user.id,
      email: tokenRecord.user.email,
    })
    const refreshTokenResult = await this.generateRefreshToken(tokenRecord.user.id)

    return {
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        username: tokenRecord.user.username,
        displayName: tokenRecord.user.displayName,
      },
      accessToken,
      refreshToken: refreshTokenResult.token,
      refreshTokenExpiresAt: refreshTokenResult.expiresAt,
    }
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenRecord = await this.db.query.refreshTokens.findFirst({
      where: and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())),
    })

    if (!tokenRecord) {
      return
    }

    const isValid = await bcrypt.compare(token, tokenRecord.tokenHash)
    if (!isValid) {
      return
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, tokenRecord.id))
  }
}
