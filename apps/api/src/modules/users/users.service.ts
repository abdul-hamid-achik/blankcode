import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../database/drizzle.provider.js'
import { users } from '@blankcode/db/schema'
import type { UserUpdateInput } from '@blankcode/shared'

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: Database) {}

  async findById(id: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  async findByUsername(username: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.username, username),
      columns: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  async update(id: string, input: UserUpdateInput) {
    const [user] = await this.db
      .update(users)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }
}
