import { concepts, tracks } from '@blankcode/db/schema'
import type { TrackSlug } from '@blankcode/shared'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'
import { type Database, DRIZZLE } from '../../database/drizzle.provider.js'

@Injectable()
export class TracksService {
  constructor(@Inject(DRIZZLE) private db: Database) {}

  async findAll() {
    return this.db.query.tracks.findMany({
      where: eq(tracks.isPublished, true),
      orderBy: asc(tracks.order),
    })
  }

  async findBySlug(slug: TrackSlug) {
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
