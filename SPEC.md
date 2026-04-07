# BlankCode Spaced Repetition Engine -- Implementation Spec

## Context

BlankCode is a coding exercise platform whose stated purpose is "help people practice and not forget about code." Currently it tracks what you've completed but has no concept of *when* you should review something next. This spec adds a proper spaced repetition (SR) scheduler based on the SM-2 algorithm.

## Goal

When a user completes an exercise, schedule it for review at increasing intervals. Show a "Review Due" section on the dashboard listing exercises that are due for review today. This is the single highest-impact feature missing from the product.

---

## 1. Database: New `review_schedules` Table

**File:** `packages/db/src/schema/index.ts`

Add a new table:

```typescript
export const reviewSchedules = pgTable('review_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  intervalDays: integer('interval_days').notNull().default(1),
  repetitions: integer('repetitions').notNull().default(0),
  easeFactor: real('ease_factor').notNull().default(2.5),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }).notNull(),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('review_schedules_user_exercise_idx').on(table.userId, table.exerciseId),
  index('review_schedules_next_review_idx').on(table.nextReviewAt),
  index('review_schedules_user_id_idx').on(table.userId),
])
```

Add the relation in `usersRelations`, `exercisesRelations`.

Add to `usersRelations`:
```typescript
reviewSchedules: many(reviewSchedules),
```

Add to `exercisesRelations`:
```typescript
reviewSchedules: many(reviewSchedules),
```

---

## 2. Shared Types: SM-2 Result Type

**File:** `packages/shared/src/types/index.ts`

Add:
```typescript
export interface ReviewSchedule {
  id: string
  userId: string
  exerciseId: string
  intervalDays: number
  repetitions: number
  easeFactor: number
  nextReviewAt: string  // ISO timestamp
  lastReviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewExercise extends Exercise {
  schedule: ReviewSchedule | null
}
```

Add `ReviewSchedule` to the exports in `packages/shared/src/index.ts`.

---

## 3. SM-2 Scheduling Logic

**File:** `apps/api/src/modules/reviews/scheduler.ts` (new)

Implement pure functions for SM-2 calculation. Do NOT put this in a service class -- it's stateless logic.

```typescript
// Quality ratings for submission results
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5
// 0-2: fail/reset, 3: hard, 4: good, 5: easy

export interface SM2Result {
  intervalDays: number
  repetitions: number
  easeFactor: number
  nextReviewAt: Date
}

/**
 * SM-2 inspired scheduler.
 * quality: 0=fail, 3=hard, 4=good, 5=easy
 */
export function calculateNextReview(
  quality: ReviewQuality,
  currentInterval: number,
  currentRepetitions: number,
  currentEaseFactor: number
): SM2Result {
  if (quality < 3) {
    // Failed/incorrect -- reset
    return {
      intervalDays: 1,
      repetitions: 0,
      easeFactor: Math.max(1.3, currentEaseFactor - 0.2),
      nextReviewAt: addDays(new Date(), 1),
    }
  }

  const newEaseFactor = Math.max(
    1.3,
    currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  let intervalDays: number
  if (currentRepetitions === 0) {
    intervalDays = 1
  } else if (currentRepetitions === 1) {
    intervalDays = 3
  } else {
    intervalDays = Math.round(currentInterval * newEaseFactor)
  }

  // Quality-based interval modifier
  if (quality === 3) intervalDays = Math.round(intervalDays * 0.8)  // hard
  if (quality === 5) intervalDays = Math.round(intervalDays * 1.3)  // easy

  return {
    intervalDays,
    repetitions: currentRepetitions + 1,
    easeFactor: newEaseFactor,
    nextReviewAt: addDays(new Date(), intervalDays),
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
```

---

## 4. Reviews Module (Backend)

**File:** `apps/api/src/modules/reviews/reviews.service.ts` (new)

Create a new NestJS module `ReviewsModule` with a `ReviewsService`.

Key methods:

```typescript
class ReviewsService {
  // Called when a submission passes -- schedule or update review
  scheduleReview(userId: string, exerciseId: string, passed: boolean): Promise<void>

  // Get exercises due for review for a user
  getDueReviews(userId: string): Promise<ReviewExercise[]>

  // Get count of due reviews (for dashboard badge)
  getDueCount(userId: string): Promise<number>

  // Record a review attempt (when user re-submits a due exercise)
  recordReview(userId: string, exerciseId: string, passed: boolean): Promise<void>

  // Map submission result to SM-2 quality
  private submissionToQuality(submission: Submission): ReviewQuality
}
```

**scheduleReview logic:**
- If `passed === false`: call `calculateNextReview(1, ...)` to reset
- If `passed === true`: 
  - Look up existing schedule for this user+exercise
  - Call `calculateNextReview(4, ...)` (assume "good" for passed submissions)
  - Upsert the schedule row

**getDueReviews logic:**
- Query `review_schedules` where `userId = ?` AND `nextReviewAt <= now()`
- Join with exercises table to get exercise data
- Return ordered by `nextReviewAt` ASC (oldest first)

**submissionToQuality logic:**
- If submission has `executionTimeMs` and test results: fast + all pass = quality 5 (easy)
- If submission has attempts > 1: quality 4 (good, they had to retry)
- Default: quality 4

**File:** `apps/api/src/modules/reviews/reviews.controller.ts` (new)

```typescript
// GET /reviews/due
// Returns exercises due for review
// Auth required

// GET /reviews/due/count  
// Returns { count: number }

// POST /reviews/:exerciseId/complete
// Body: { passed: boolean }
// Called when user re-submits a due exercise
```

**Module wiring:** Add to `apps/api/src/modules/index.ts` and the app module.

---

## 5. Update Progress Service: Call SR Scheduler on Submission

**File:** `apps/api/src/modules/submissions/submissions.service.ts`

After `markExerciseCompleted` is called (which happens in the worker after a passed submission), call `ReviewsService.scheduleReview(userId, exerciseId, true)`.

Actually, the better place to hook this is in the worker or in the controller after the submission is processed and marked complete. Look at how `markExerciseCompleted` is called -- it's in the submissions controller or a worker. Hook into the same spot for the `scheduleReview` call.

**Important:** This should be fire-and-forget. If SR scheduling fails, the submission should still succeed. Wrap in try/catch and log errors only.

---

## 6. Frontend: Review Due Page

**File:** `apps/web/pages/review.vue` (new)

A dedicated `/review` page. Only accessible to authenticated users.

Layout:
- Header: "Review" with the due count badge
- If no exercises due: show encouraging message ("You're all caught up! Come back tomorrow.")
- List of due exercises:
  - Exercise title + track name
  - Last reviewed date (or "Never" if first time)
  - Current interval (e.g., "Reviewing: Day 3")
  - "Start Review" button → navigates to `/exercise/[id]`
- After a review is completed and passed, the exercise should be removed from the due list

API call on mount:
```typescript
const { data } = await useFetch('/api/reviews/due')
```

**File:** `apps/web/stores/review.ts` (new)

```typescript
export const useReviewStore = defineStore('review', () => {
  const dueExercises = ref<ReviewExercise[]>([])
  const dueCount = ref(0)
  const isLoading = ref(false)

  async function loadDueReviews() { /* GET /reviews/due */ }
  async function loadDueCount() { /* GET /reviews/due/count */ }
  
  return { dueExercises, dueCount, isLoading, loadDueReviews, loadDueCount }
})
```

---

## 7. Dashboard Integration

**File:** `apps/web/pages/dashboard.vue`

Add a "Review" card or tab alongside existing stats:

```
+---------------------------+
| 🔁 Review Due             |
| 5 exercises ready for     |
| review today              |
| [Start Review]            |
+---------------------------+
```

The link goes to `/review`. The count comes from `GET /reviews/due/count` (can be called on dashboard load without blocking).

---

## 8. Tests

**File:** `apps/api/src/__tests__/scheduler.test.ts` (new)

Test the SM-2 functions:
- First successful review → interval 1 day
- Second successful review → interval 3 days  
- Third successful review → interval = 3 * easeFactor
- Failed review → reset to 1 day, easeFactor decreases
- Hard (quality=3) → interval multiplied by 0.8
- Easy (quality=5) → interval multiplied by 1.3

**File:** `apps/api/src/__tests__/reviews.service.test.ts` (new)

Test the ReviewsService:
- `scheduleReview` creates a new schedule on first pass
- `scheduleReview` updates interval on subsequent pass
- `scheduleReview` resets on failed attempt
- `getDueReviews` returns only exercises where `nextReviewAt <= now()`
- `getDueReviews` excludes exercises where `nextReviewAt > now()`

---

## File Summary

```
NEW files:
  packages/db/src/schema/index.ts          (add reviewSchedules table + relations)
  packages/shared/src/types/index.ts       (add ReviewSchedule, ReviewExercise types)
  packages/shared/src/index.ts              (export new types)
  apps/api/src/modules/reviews/scheduler.ts (SM-2 pure functions)
  apps/api/src/modules/reviews/reviews.service.ts
  apps/api/src/modules/reviews/reviews.controller.ts
  apps/api/src/modules/reviews/index.ts
  apps/api/src/__tests__/scheduler.test.ts
  apps/api/src/__tests__/reviews.service.test.ts
  apps/web/stores/review.ts
  apps/web/pages/review.vue

MODIFIED files:
  apps/api/src/modules/submissions/submissions.service.ts  (call scheduleReview on pass)
  apps/api/src/modules/index.ts                            (register ReviewsModule)
  apps/api/src/app.module.ts                             (import ReviewsModule)
  apps/web/pages/dashboard.vue                            (add Review Due card)
```

---

## Dependencies & Ordering

1. First: DB schema + shared types (no dependencies)
2. Second: scheduler.ts (pure functions, no dependencies)
3. Third: reviews.service.ts + reviews.controller.ts (depends on schema + scheduler)
4. Fourth: wire into submissions service (depends on reviews service)
5. Fifth: frontend (depends on API existing)
6. Sixth: tests

---

## Out of Scope (do not implement)

- Achievement integration with SR (save for later)
- "Cram" / advance review feature (just let them do it naturally)
- Email/notification reminders
- Modifying intervals manually
