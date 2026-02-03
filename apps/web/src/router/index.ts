import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/home-view.vue'),
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
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta['requiresAuth'] && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (to.meta['guestOnly'] && authStore.isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export { router }
