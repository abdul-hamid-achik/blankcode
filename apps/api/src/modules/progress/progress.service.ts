import { Injectable, Inject } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../database/drizzle.provider.js'
import { userProgress, conceptMastery, exercises, concepts } from '@blankcode/db/schema'

@Injectable()
export class ProgressService {
  constructor(@Inject(DRIZZLE) private db: Database) {}

  async getExerciseProgress(userId: string, exerciseId: string) {
    const progress = await this.db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, userId), eq(userProgress.exerciseId, exerciseId)),
    })

    return progress ?? null
  }

  async getConceptMastery(userId: string, conceptId: string) {
    const mastery = await this.db.query.conceptMastery.findFirst({
      where: and(eq(conceptMastery.userId, userId), eq(conceptMastery.conceptId, conceptId)),
    })

    return mastery ?? null
  }

  async getTrackProgress(userId: string, trackSlug: string) {
    const trackConcepts = await this.db.query.concepts.findMany({
      with: {
        track: true,
        exercises: true,
      },
    })

    const filteredConcepts = trackConcepts.filter((c) => c.track.slug === trackSlug)

    const masteryRecords = await this.db.query.conceptMastery.findMany({
      where: eq(conceptMastery.userId, userId),
    })

    const masteryMap = new Map(masteryRecords.map((m) => [m.conceptId, m]))

    return filteredConcepts.map((concept) => ({
      conceptId: concept.id,
      conceptSlug: concept.slug,
      conceptName: concept.name,
      mastery: masteryMap.get(concept.id) ?? null,
      totalExercises: concept.exercises.length,
    }))
  }

  async markExerciseCompleted(userId: string, exerciseId: string, submissionId: string) {
    const existing = await this.getExerciseProgress(userId, exerciseId)

    if (existing) {
      await this.db
        .update(userProgress)
        .set({
          isCompleted: true,
          attempts: existing.attempts + 1,
          bestSubmissionId: submissionId,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProgress.id, existing.id))
    } else {
      await this.db.insert(userProgress).values({
        userId,
        exerciseId,
        isCompleted: true,
        attempts: 1,
        bestSubmissionId: submissionId,
        completedAt: new Date(),
      })
    }

    await this.updateConceptMastery(userId, exerciseId)
  }

  async incrementAttempts(userId: string, exerciseId: string) {
    const existing = await this.getExerciseProgress(userId, exerciseId)

    if (existing) {
      await this.db
        .update(userProgress)
        .set({
          attempts: existing.attempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(userProgress.id, existing.id))
    } else {
      await this.db.insert(userProgress).values({
        userId,
        exerciseId,
        isCompleted: false,
        attempts: 1,
      })
    }
  }

  private async updateConceptMastery(userId: string, exerciseId: string) {
    const exercise = await this.db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: {
        concept: true,
      },
    })

    if (!exercise) return

    const conceptExercises = await this.db.query.exercises.findMany({
      where: eq(exercises.conceptId, exercise.conceptId),
    })

    const completedProgress = await this.db.query.userProgress.findMany({
      where: and(
        eq(userProgress.userId, userId),
        eq(userProgress.isCompleted, true)
      ),
    })

    const completedExerciseIds = new Set(completedProgress.map((p) => p.exerciseId))
    const completedInConcept = conceptExercises.filter((e) =>
      completedExerciseIds.has(e.id)
    ).length

    const masteryLevel = completedInConcept / conceptExercises.length

    const existing = await this.getConceptMastery(userId, exercise.conceptId)

    if (existing) {
      await this.db
        .update(conceptMastery)
        .set({
          masteryLevel,
          exercisesCompleted: completedInConcept,
          exercisesTotal: conceptExercises.length,
          lastPracticedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conceptMastery.id, existing.id))
    } else {
      await this.db.insert(conceptMastery).values({
        userId,
        conceptId: exercise.conceptId,
        masteryLevel,
        exercisesCompleted: completedInConcept,
        exercisesTotal: conceptExercises.length,
        lastPracticedAt: new Date(),
      })
    }
  }
}
