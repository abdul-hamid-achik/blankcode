export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  try {
    await authStore.initialize()
  } catch {
    // Auth init failed - treat as unauthenticated
  }

  if (to.meta['requiresAuth'] && !authStore.isAuthenticated) {
    return navigateTo(`/login?redirect=${to.path}`)
  }

  if (to.meta['guestOnly'] && authStore.isAuthenticated) {
    return navigateTo('/dashboard')
  }
})
