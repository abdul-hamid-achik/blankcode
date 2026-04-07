import type {
  Concept,
  Exercise,
  LearningPath,
  ReviewExercise,
  Submission,
  SubmissionCreateInput,
  Track,
  User,
  UserAchievement,
  UserCreateInput,
  UserLoginInput,
} from '@blankcode/shared'

export function useApi() {
  const tokenCookie = useCookie<string | null>('token')
  const refreshCookie = useCookie<string | null>('refresh-token')
  const {
    public: { apiUrl },
  } = useRuntimeConfig()

  let isRefreshing = false
  let refreshPromise: Promise<string | null> | null = null

  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = refreshCookie.value
    if (!refreshToken) return null

    try {
      const response = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        tokenCookie.value = null
        refreshCookie.value = null
        return null
      }

      const data = await response.json()
      tokenCookie.value = data.accessToken
      refreshCookie.value = data.refreshToken
      return data.accessToken
    } catch {
      tokenCookie.value = null
      refreshCookie.value = null
      return null
    }
  }

  async function request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const token = tokenCookie.value

    const headers: Record<string, string> = {
      ...(options.method === 'DELETE' || !options.body
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...((options.headers as Record<string, string>) ?? {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    let response: Response
    try {
      response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (response.status === 401 && retryCount === 0) {
      if (!isRefreshing) {
        isRefreshing = true
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false
          refreshPromise = null
        })
      }

      const newToken = await refreshPromise

      if (newToken) {
        return request(endpoint, options, retryCount + 1)
      } else {
        if (import.meta.client) {
          window.dispatchEvent(new Event('auth:logout'))
        }
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message ?? 'Request failed')
    }

    if (response.status === 204) {
      return undefined as T
    }

    const json = await response.json()
    return json.data ?? json
  }

  return {
    auth: {
      login: (data: UserLoginInput) =>
        request<{
          user: User
          accessToken: string
          refreshToken: string
          refreshTokenExpiresAt: string
        }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      register: (data: UserCreateInput) =>
        request<{
          user: User
          accessToken: string
          refreshToken: string
          refreshTokenExpiresAt: string
        }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      logout: () => {
        const refreshToken = refreshCookie.value
        if (refreshToken) {
          request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) })
        }
        tokenCookie.value = null
        refreshCookie.value = null
      },
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
      getAll: () => request<Exercise[]>('/exercises'),
      getByConcept: (trackSlug: string, conceptSlug: string) =>
        request<Exercise[]>(`/tracks/${trackSlug}/concepts/${conceptSlug}/exercises`),
      getBySlug: (trackSlug: string, conceptSlug: string, exerciseSlug: string) =>
        request<Exercise>(`/tracks/${trackSlug}/concepts/${conceptSlug}/exercises/${exerciseSlug}`),
      getById: (id: string) => request<Exercise>(`/exercises/${id}`),
      getWithProgress: (id: string) =>
        request<{
          exercise: Exercise
          code: string
          codeSource: 'draft' | 'submission' | 'starter'
          draft: { updatedAt: string } | null
          lastSubmission: { id: string; status: string; createdAt: string } | null
        }>(`/exercises/${id}/progress`),
      saveDraft: (id: string, code: string) =>
        request(`/exercises/${id}/draft`, { method: 'POST', body: JSON.stringify({ code }) }),
      deleteDraft: (id: string) => request(`/exercises/${id}/draft`, { method: 'DELETE' }),
    },
    submissions: {
      create: (data: SubmissionCreateInput) =>
        request<Submission>('/submissions', { method: 'POST', body: JSON.stringify(data) }),
      retry: (id: string) =>
        request<Submission>(`/submissions/${id}/retry`, { method: 'POST', body: '' }),
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
        request<
          Array<{
            trackSlug: string
            trackName: string
            totalExercises: number
            completedExercises: number
            masteryLevel: number
          }>
        >('/progress/summary'),
      getStats: () =>
        request<{
          totalExercisesCompleted: number
          currentStreak: number
          longestStreak: number
          totalSubmissions: number
          lastActivityDate: string | null
        }>('/progress/stats'),
    },
    paths: {
      getAll: () => request<LearningPath[]>('/paths'),
      getBySlug: (slug: string) => request<LearningPath>(`/paths/${slug}`),
    },
    achievements: {
      getMine: () => request<UserAchievement[]>('/achievements'),
      getAll: () => request('/achievements/definitions'),
    },
    reviews: {
      getDue: () => request<ReviewExercise[]>('/reviews/due'),
      getDueCount: () => request<{ count: number }>('/reviews/due/count'),
      complete: (exerciseId: string, passed: boolean) =>
        request<void>(`/reviews/${exerciseId}/complete`, {
          method: 'POST',
          body: JSON.stringify({ passed }),
        }),
    },
  }
}
