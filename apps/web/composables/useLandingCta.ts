import { computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

/**
 * What the landing page should be asking for.
 *
 * Every call to action said "Create an account", including to people who
 * already had one — the page had no idea anyone was signed in. Asking someone
 * to sign up for the thing they are already signed into reads as a site that
 * does not know who you are, which is a bad first impression from the page
 * whose whole job is a first impression.
 *
 * One place, so a new section cannot go back to hardcoding it.
 */
export function useLandingCta() {
  const auth = useAuthStore()

  const primary = computed(() =>
    auth.isAuthenticated
      ? // Straight to the thing they came back for. The review queue is the
        // habit; the dashboard is where it is visible.
        { to: '/review', label: 'Continue practising' }
      : { to: '/register', label: 'Create an account' }
  )

  const secondary = computed(() =>
    auth.isAuthenticated
      ? { to: '/dashboard', label: 'Your progress' }
      : { to: '/tracks', label: 'Browse the tracks' }
  )

  return { primary, secondary, isAuthenticated: computed(() => auth.isAuthenticated) }
}
