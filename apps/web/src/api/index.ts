import type {
  UserCreateInput,
  UserLoginInput,
  SubmissionCreateInput,
  Track,
  Concept,
  Exercise,
  Submission,
  User,
} from '@blankcode/shared'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message ?? 'Request failed')
  }

  const json = await response.json()
  return json.data ?? json
}

export const api = {
  auth: {
    login: (data: UserLoginInput) =>
      request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    register: (data: UserCreateInput) =>
      request<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  users: {
    getMe: () => request<User>('/users/me'),
    getByUsername: (username: string) => request<User>(`/users/${username}`),
  },

  tracks: {
    getAll: () => request<Track[]>('/tracks'),
    getBySlug: (slug: string) => request<Track & { concepts: Concept[] }>(`/tracks/${slug}`),
  },

  exercises: {
    getByConcept: (trackSlug: string, conceptSlug: string) =>
      request<Exercise[]>(`/tracks/${trackSlug}/concepts/${conceptSlug}/exercises`),
    getBySlug: (trackSlug: string, conceptSlug: string, exerciseSlug: string) =>
      request<Exercise>(
        `/tracks/${trackSlug}/concepts/${conceptSlug}/exercises/${exerciseSlug}`
      ),
    getById: (id: string) => request<Exercise>(`/exercises/${id}`),
  },

  submissions: {
    create: (data: SubmissionCreateInput) =>
      request<Submission>('/submissions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getById: (id: string) => request<Submission>(`/submissions/${id}`),
    getByExercise: (exerciseId: string) =>
      request<Submission[]>(`/submissions?exerciseId=${exerciseId}`),
    getMine: (limit?: number) =>
      request<Submission[]>(`/submissions${limit ? `?limit=${limit}` : ''}`),
  },

  progress: {
    getExercise: (exerciseId: string) => request(`/progress/exercises/${exerciseId}`),
    getConcept: (conceptId: string) => request(`/progress/concepts/${conceptId}`),
    getTrack: (trackSlug: string) => request(`/progress/tracks/${trackSlug}`),
    getSummary: () =>
      request<Array<{
        trackSlug: string
        trackName: string
        totalExercises: number
        completedExercises: number
        masteryLevel: number
      }>>('/progress/summary'),
    getStats: () =>
      request<{
        totalExercisesCompleted: number
        currentStreak: number
        longestStreak: number
        totalSubmissions: number
        lastActivityDate: string | null
      }>('/progress/stats'),
  },
}
