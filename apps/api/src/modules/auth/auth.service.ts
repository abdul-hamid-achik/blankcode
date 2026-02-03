import { users } from '@blankcode/db/schema'
import type { UserCreateInput, UserLoginInput } from '@blankcode/shared'
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
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

    const token = this.jwtService.sign({ sub: user.id, email: user.email })

    return { user, token }
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

    const token = this.jwtService.sign({ sub: user.id, email: user.email })

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      token,
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
}
