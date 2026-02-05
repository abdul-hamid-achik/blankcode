import type {
  Concept,
  Exercise,
  Submission,
  SubmissionCreateInput,
  Track,
  User,
  UserCreateInput,
  UserLoginInput,
} from '@blankcode/shared'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function onTokenRefreshed(token: string) {
  for (const callback of refreshSubscribers) {
    callback(token)
  }
  refreshSubscribers = []
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback)
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return null

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      return null
    }

    const data = await response.json()
    localStorage.setItem('token', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    return data.accessToken
  } catch {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    return null
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
  const token = localStorage.getItem('token')

  const headers: Record<string, string> = {
    ...(options.method === 'DELETE' || !options.body ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) ?? {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && retryCount === 0) {
    if (isRefreshing) {
      return new Promise((resolve) => {
        addRefreshSubscriber((newToken) => {
          headers['Authorization'] = `Bearer ${newToken}`
          fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
          })
            .then((res) => res.json())
            .then((json) => resolve(json.data ?? json))
        })
      })
    }

    isRefreshing = true
    const newToken = await refreshAccessToken()
    isRefreshing = false

    if (newToken) {
      onTokenRefreshed(newToken)
      return request(endpoint, options, retryCount + 1)
    } else {
      window.dispatchEvent(new Event('auth:logout'))
    }
  }

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
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        })
      }
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
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
      request(`/exercises/${id}/draft`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    deleteDraft: (id: string) =>
      request(`/exercises/${id}/draft`, {
        method: 'DELETE',
      }),
    retry: (id: string) =>
      request<Submission>(`/submissions/${id}/retry`, {
        method: 'POST',
      }),
  },

  submissions: {
    create: (data: SubmissionCreateInput) =>
      request<Submission>('/submissions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    retry: (id: string) =>
      request<Submission>(`/submissions/${id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '',
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
}
