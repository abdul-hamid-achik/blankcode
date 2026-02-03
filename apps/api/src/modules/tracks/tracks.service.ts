import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { eq, asc } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../database/drizzle.provider.js'
import { tracks, concepts } from '@blankcode/db/schema'

@Injectable()
export class TracksService {
  constructor(@Inject(DRIZZLE) private db: Database) {}

  async findAll() {
    return this.db.query.tracks.findMany({
      where: eq(tracks.isPublished, true),
      orderBy: asc(tracks.order),
    })
  }

  async findBySlug(slug: string) {
    const track = await this.db.query.tracks.findFirst({
      where: eq(tracks.slug, slug),
      with: {
        concepts: {
          where: eq(concepts.isPublished, true),
          orderBy: asc(concepts.order),
        },
      },
    })

    if (!track) {
      throw new NotFoundException('Track not found')
    }

    return track
  }

  async findById(id: string) {
    const track = await this.db.query.tracks.findFirst({
      where: eq(tracks.id, id),
    })

    if (!track) {
      throw new NotFoundException('Track not found')
    }

    return track
  }
}
