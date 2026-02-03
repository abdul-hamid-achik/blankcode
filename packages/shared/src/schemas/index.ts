import { z } from 'zod'
import type { Difficulty, SubmissionStatus, TrackSlug } from '../types/index.js'

export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert'])

export const submissionStatusSchema = z.enum(['pending', 'running', 'passed', 'failed', 'error'])

export const trackSlugSchema = z.enum(['typescript', 'vue', 'react', 'node', 'go', 'rust', 'python'])

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const userCreateSchema = z.object({
  email: z.email(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100).optional(),
})

export const userLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const userUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.url().optional(),
})

export const trackCreateSchema = z.object({
  slug: trackSlugSchema,
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  iconUrl: z.url().optional(),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(false),
})

export const conceptCreateSchema = z.object({
  trackId: z.uuid(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(false),
})

export const exerciseCreateSchema = z.object({
  conceptId: z.uuid(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  difficulty: difficultySchema,
  starterCode: z.string().min(1),
  solutionCode: z.string().min(1),
  testCode: z.string().min(1),
  hints: z.array(z.string()).default([]),
  order: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(false),
})

export const submissionCreateSchema = z.object({
  exerciseId: z.uuid(),
  code: z.string().min(1).max(50000),
})

export const blankRegionSchema = z.object({
  id: z.string(),
  startLine: z.number().int().nonnegative(),
  startColumn: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  endColumn: z.number().int().nonnegative(),
  placeholder: z.string(),
  solution: z.string(),
})

export const exerciseFrontmatterSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  difficulty: difficultySchema,
  hints: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserLoginInput = z.infer<typeof userLoginSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type TrackCreateInput = z.infer<typeof trackCreateSchema>
export type ConceptCreateInput = z.infer<typeof conceptCreateSchema>
export type ExerciseCreateInput = z.infer<typeof exerciseCreateSchema>
export type SubmissionCreateInput = z.infer<typeof submissionCreateSchema>
export type BlankRegionInput = z.infer<typeof blankRegionSchema>
export type ExerciseFrontmatterInput = z.infer<typeof exerciseFrontmatterSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
