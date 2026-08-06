<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import Input from '~/components/ui/input.vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ guestOnly: true, middleware: 'auth' })

const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  error.value = ''
  isLoading.value = true

  try {
    await authStore.login(email.value, password.value)
    const redirectTo = route.query['redirect'] as string | undefined
    const safeRedirect =
      redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/dashboard'
    navigateTo(safeRedirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="mb-8">
        <p class="eyebrow mb-2">sign in</p>
        <h1 class="display text-2xl">Back to it.</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Your progress and review schedule live in your own database.
        </p>
      </div>

      <Card>
        <form @submit.prevent="handleSubmit" class="w-full space-y-4">
          <div
            v-if="error"
            class="border-l-2 border-fail bg-fail/5 px-4 py-2 text-sm text-fail"
            role="alert"
          >
            {{ error }}
          </div>

          <Input
            id="login-email"
            v-model="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />

          <Input
            id="login-password"
            v-model="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />

          <Button type="submit" :loading="isLoading" class="w-full"> Sign in </Button>
        </form>
      </Card>

      <p class="text-center text-sm text-muted-foreground mt-4">
        Don't have an account?
        <NuxtLink to="/register" class="text-primary hover:underline"> Sign up </NuxtLink>
      </p>
    </div>
  </div>
</template>
