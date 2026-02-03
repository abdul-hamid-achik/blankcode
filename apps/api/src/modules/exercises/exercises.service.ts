import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { eq, and, asc } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../database/drizzle.provider.js'
import { exercises, concepts } from '@blankcode/db/schema'

@Injectable()
export class ExercisesService {
  constructor(@Inject(DRIZZLE) private db: Database) {}

  async findByConceptSlug(trackSlug: string, conceptSlug: string) {
    const concept = await this.db.query.concepts.findFirst({
      where: eq(concepts.slug, conceptSlug),
      with: {
        track: true,
        exercises: {
          where: eq(exercises.isPublished, true),
          orderBy: asc(exercises.order),
        },
      },
    })

    if (!concept || concept.track.slug !== trackSlug) {
      throw new NotFoundException('Concept not found')
    }

    return concept.exercises
  }

  async findBySlug(trackSlug: string, conceptSlug: string, exerciseSlug: string) {
    const concept = await this.db.query.concepts.findFirst({
      where: eq(concepts.slug, conceptSlug),
      with: {
        track: true,
      },
    })

    if (!concept || concept.track.slug !== trackSlug) {
      throw new NotFoundException('Concept not found')
    }

    const exercise = await this.db.query.exercises.findFirst({
      where: and(eq(exercises.conceptId, concept.id), eq(exercises.slug, exerciseSlug)),
    })

    if (!exercise) {
      throw new NotFoundException('Exercise not found')
    }

    return exercise
  }

  async findById(id: string) {
    const exercise = await this.db.query.exercises.findFirst({
      where: eq(exercises.id, id),
      with: {
        concept: {
          with: {
            track: true,
          },
        },
      },
    })

    if (!exercise) {
      throw new NotFoundException('Exercise not found')
    }

    return exercise
  }
}
