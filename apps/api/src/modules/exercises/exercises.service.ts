import { codeDrafts, concepts, exercises, submissions } from '@blankcode/db/schema'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, desc, eq } from 'drizzle-orm'
import { type Database, DRIZZLE } from '../../database/drizzle.provider.js'

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

  async findWithProgress(exerciseId: string, userId: string) {
    const exercise = await this.db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
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

    const draft = await this.db.query.codeDrafts.findFirst({
      where: and(eq(codeDrafts.userId, userId), eq(codeDrafts.exerciseId, exerciseId)),
    })

    const lastSubmission = await this.db.query.submissions.findFirst({
      where: and(eq(submissions.userId, userId), eq(submissions.exerciseId, exerciseId)),
      orderBy: desc(submissions.createdAt),
    })

    let code: string
    let codeSource: 'draft' | 'submission' | 'starter'

    if (draft) {
      code = draft.code
      codeSource = 'draft'
    } else if (lastSubmission) {
      code = lastSubmission.code
      codeSource = 'submission'
    } else {
      code = exercise.starterCode
      codeSource = 'starter'
    }

    return {
      exercise,
      code,
      codeSource,
      draft: draft
        ? {
            updatedAt: draft.updatedAt,
          }
        : null,
      lastSubmission: lastSubmission
        ? {
            id: lastSubmission.id,
            status: lastSubmission.status,
            createdAt: lastSubmission.createdAt,
          }
        : null,
    }
  }

  async saveDraft(userId: string, exerciseId: string, code: string) {
    const exercise = await this.db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
    })

    if (!exercise) {
      throw new NotFoundException('Exercise not found')
    }

    await this.db
      .insert(codeDrafts)
      .values({ userId, exerciseId, code, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [codeDrafts.userId, codeDrafts.exerciseId],
        set: { code, updatedAt: new Date() },
      })

    return { success: true }
  }

  async deleteDraft(userId: string, exerciseId: string) {
    await this.db
      .delete(codeDrafts)
      .where(and(eq(codeDrafts.userId, userId), eq(codeDrafts.exerciseId, exerciseId)))
    return { success: true }
  }
}
