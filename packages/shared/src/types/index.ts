export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const SUBMISSION_STATUSES = ['pending', 'running', 'passed', 'failed', 'error'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export const TRACK_SLUGS = ['typescript', 'vue', 'react', 'node', 'go', 'rust', 'python'] as const
export type TrackSlug = (typeof TRACK_SLUGS)[number]

/*
 * `blank`     — the starter has regions removed; you produce them from memory.
 * `challenge` — you write the whole thing from a stub.
 * `review`    — the starter is code that already looks finished and is wrong.
 *               You find the defect before submitting. This is the one that
 *               trains reading code you did not write, which is the skill that
 *               stopped being optional once a model could produce two hundred
 *               plausible lines in four seconds.
 */
export const EXERCISE_TYPES = ['blank', 'challenge', 'review', 'turn', 'context'] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export const ACHIEVEMENT_TYPES = [
  'first_challenge',
  'challenge_master',
  'challenge_legend',
  'polyglot',
  'expert',
  'speed_demon',
  'perfectionist',
  'marathon',
  'language_specialist',
] as const
export type AchievementType = (typeof ACHIEVEMENT_TYPES)[number]

export interface User {
  id: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Track {
  id: string
  slug: TrackSlug
  name: string
  description: string
  iconUrl: string | null
  order: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Concept {
  id: string
  trackId: string
  slug: string
  name: string
  description: string
  order: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Exercise {
  id: string
  conceptId: string
  slug: string
  title: string
  description: string
  difficulty: Difficulty
  type: ExerciseType
  starterCode: string
  solutionCode: string
  testCode: string
  hints: string[]
  blanks: BlankRegionInStarter[]
  order: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

export interface BlankRegion {
  id: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  placeholder: string
  solution: string
}

export interface BlankRegionInStarter {
  id: string
  from: number // char offset in starterCode
  to: number // char offset in starterCode
  placeholder: string
  solution: string
}

export interface ContextSourceDefinition {
  sources: Array<{ id: string; label: string; tokens: number; content: string }>
  required: string[]
  /** A regular expression, as a string, that an accepted answer must match. */
  accept: string
}

export interface ParsedExercise {
  frontmatter: ExerciseFrontmatter
  content: string
  blanks: BlankRegion[]
  blanksInStarter: BlankRegionInStarter[]
  starterCode: string
  solutionCode: string
  type: ExerciseType
  /** Present only on context-selection exercises. */
  contextSources: ContextSourceDefinition | null
}

export interface ExerciseFrontmatter {
  slug: string
  title: string
  description: string
  difficulty: Difficulty
  type?: ExerciseType
  hints?: string[] | undefined
  tags?: string[] | undefined
  /**
   * Turn-budget exercises only: how many messages the learner gets.
   *
   * Authored per exercise rather than a global constant, because the budget is
   * the difficulty knob — a three-turn task and a six-turn task are different
   * exercises, not the same one configured differently.
   */
  turnBudget?: number | undefined
}

export interface Submission {
  id: string
  userId: string
  exerciseId: string
  code: string
  status: SubmissionStatus
  testResults: TestResult[] | null
  errorMessage: string | null
  executionTimeMs: number | null
  createdAt: Date
  updatedAt: Date
}

export interface TestResult {
  name: string
  passed: boolean
  message: string | null
  duration: number
}

/**
 * What `POST /submissions/run` returns: the execution outcome and nothing
 * else. No submission exists, so there is no id, no persistence, and no
 * verdict of record — a green run still has to be submitted to count.
 * `runsRemainingToday` is null when unmetered (paid) or uncountable.
 */
export interface RunOutcome {
  status: 'passed' | 'failed' | 'error'
  testResults: TestResult[]
  executionTimeMs: number | null
  errorMessage: string | null
  runsRemainingToday: number | null
}

export interface UserProgress {
  id: string
  userId: string
  exerciseId: string
  isCompleted: boolean
  attempts: number
  bestSubmissionId: string | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ConceptMastery {
  id: string
  userId: string
  conceptId: string
  masteryLevel: number
  exercisesCompleted: number
  exercisesTotal: number
  lastPracticedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ApiResponse<T> {
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface TrackWithConcepts extends Track {
  concepts: Concept[]
}

export interface ConceptWithExercises extends Concept {
  exercises: Exercise[]
}

export interface ExerciseWithProgress extends Exercise {
  progress: UserProgress | null
}

export interface LearningPath {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  color: string
  order: number
  challengeIds: string[]
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserAchievement {
  id: string
  userId: string
  achievementType: AchievementType
  title: string
  description: string
  icon: string
  earnedAt: Date
  metadata?: Record<string, unknown>
}

export interface AchievementDefinition {
  type: AchievementType
  title: string
  description: string
  icon: string
  color: string
  requirement: {
    type: 'challenges_completed' | 'languages_completed' | 'streak' | 'perfect_score' | 'time_limit'
    count?: number
    languages?: string[]
    timeMs?: number
  }
}

export interface ReviewSchedule {
  id: string
  userId: string
  exerciseId: string
  intervalDays: number
  repetitions: number
  easeFactor: number
  nextReviewAt: string // ISO timestamp
  lastReviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewExercise extends Exercise {
  schedule: ReviewSchedule | null
}
