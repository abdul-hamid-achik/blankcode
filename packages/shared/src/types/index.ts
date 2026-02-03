export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export type SubmissionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error'

export type TrackSlug = 'typescript' | 'vue' | 'react' | 'node' | 'go' | 'rust'

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
  starterCode: string
  solutionCode: string
  testCode: string
  hints: string[]
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

export interface ParsedExercise {
  frontmatter: ExerciseFrontmatter
  content: string
  blanks: BlankRegion[]
  starterCode: string
  solutionCode: string
}

export interface ExerciseFrontmatter {
  slug: string
  title: string
  description: string
  difficulty: Difficulty
  hints?: string[]
  tags?: string[]
}

export interface Submission {
  id: string
  userId: string
  exerciseId: string
  code: string
  status: SubmissionStatus
  testResults: TestResult[] | null
  executionTimeMs: number | null
  createdAt: Date
}

export interface TestResult {
  name: string
  passed: boolean
  message: string | null
  duration: number
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
