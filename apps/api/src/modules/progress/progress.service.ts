import { Injectable, Inject } from '@nestjs/common'
import { eq, and, count, desc, sql } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../database/drizzle.provider.js'
import { userProgress, conceptMastery, exercises, concepts, tracks, submissions } from '@blankcode/db/schema'

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

  async getSummary(userId: string) {
    const allTracks = await this.db.query.tracks.findMany({
      with: {
        concepts: {
          with: {
            exercises: true,
          },
        },
      },
    })

    const completedProgress = await this.db.query.userProgress.findMany({
      where: and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)),
    })

    const completedExerciseIds = new Set(completedProgress.map((p) => p.exerciseId))

    return allTracks.map((track) => {
      const trackExercises = track.concepts.flatMap((c) => c.exercises)
      const completedInTrack = trackExercises.filter((e) => completedExerciseIds.has(e.id)).length
      const totalInTrack = trackExercises.length

      return {
        trackSlug: track.slug,
        trackName: track.name,
        totalExercises: totalInTrack,
        completedExercises: completedInTrack,
        masteryLevel: totalInTrack > 0 ? completedInTrack / totalInTrack : 0,
      }
    })
  }

  async getStats(userId: string) {
    const completedProgress = await this.db.query.userProgress.findMany({
      where: and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)),
      orderBy: desc(userProgress.completedAt),
    })

    const userSubmissions = await this.db.query.submissions.findMany({
      where: eq(submissions.userId, userId),
    })

    const totalExercisesCompleted = completedProgress.length
    const totalSubmissions = userSubmissions.length

    // Calculate streak
    const { currentStreak, longestStreak } = this.calculateStreak(completedProgress)

    const lastActivityDate = completedProgress[0]?.completedAt ?? null

    return {
      totalExercisesCompleted,
      currentStreak,
      longestStreak,
      totalSubmissions,
      lastActivityDate: lastActivityDate?.toISOString() ?? null,
    }
  }

  private calculateStreak(completedProgress: { completedAt: Date | null }[]) {
    if (completedProgress.length === 0) {
      return { currentStreak: 0, longestStreak: 0 }
    }

    const dates = completedProgress
      .map((p) => p.completedAt)
      .filter((d): d is Date => d !== null)
      .map((d) => {
        const date = new Date(d)
        date.setHours(0, 0, 0, 0)
        return date.getTime()
      })
      .filter((d, i, arr) => arr.indexOf(d) === i)
      .sort((a, b) => b - a)

    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTime = today.getTime()
    const oneDay = 24 * 60 * 60 * 1000

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 1

    // Check if today or yesterday has activity for current streak
    if (dates[0] === todayTime || dates[0] === todayTime - oneDay) {
      currentStreak = 1
      for (let i = 1; i < dates.length; i++) {
        if (dates[i - 1]! - dates[i]! === oneDay) {
          currentStreak++
        } else {
          break
        }
      }
    }

    // Calculate longest streak
    for (let i = 1; i < dates.length; i++) {
      if (dates[i - 1]! - dates[i]! === oneDay) {
        tempStreak++
      } else {
        longestStreak = Math.max(longestStreak, tempStreak)
        tempStreak = 1
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak)

    return { currentStreak, longestStreak }
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
