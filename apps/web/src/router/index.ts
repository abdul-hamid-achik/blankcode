import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/home-view.vue'),
    },
    {
      path: '/tutorials',
      name: 'tutorials',
      component: () => import('@/views/tutorials-view.vue'),
    },
    {
      path: '/tutorials/:slug',
      name: 'tutorial',
      component: () => import('@/views/tutorial-view.vue'),
    },
    {
      path: '/tracks',
      name: 'tracks',
      component: () => import('@/views/tracks-view.vue'),
    },
    {
      path: '/tracks/:trackSlug',
      name: 'track',
      component: () => import('@/views/track-view.vue'),
    },
    {
      path: '/tracks/:trackSlug/:conceptSlug',
      name: 'concept',
      component: () => import('@/views/concept-view.vue'),
    },
    {
      path: '/exercise/:exerciseId',
      name: 'exercise',
      component: () => import('@/views/exercise-view.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login-view.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/register-view.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/dashboard-view.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/settings-view.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/progress',
      name: 'progress',
      component: () => import('@/views/progress-view.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/not-found-view.vue'),
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  try {
    await authStore.initialize()
  } catch (error) {
    console.error('Auth initialization failed:', error)
    // Allow navigation to continue - auth state will be unauthenticated
  }

  if (to.meta['requiresAuth'] && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (to.meta['guestOnly'] && authStore.isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export { router }
