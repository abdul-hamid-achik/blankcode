export default defineNuxtPlugin(() => {
  window.addEventListener('auth:logout', () => {
    const authStore = useAuthStore()
    authStore.logout()
    navigateTo('/login')
  })
})
