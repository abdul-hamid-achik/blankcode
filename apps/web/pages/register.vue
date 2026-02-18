<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import Input from '~/components/ui/input.vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ guestOnly: true, middleware: 'auth' })

const authStore = useAuthStore()

const email = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }

  isLoading.value = true

  try {
    await authStore.register(email.value, username.value, password.value)
    navigateTo('/dashboard')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Registration failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold">Create an account</h1>
        <p class="text-muted-foreground mt-1">Start your coding journey</p>
      </div>

      <Card>
        <form @submit.prevent="handleSubmit" class="w-full space-y-4">
          <div v-if="error" class="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded">
            {{ error }}
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium block">Email</label>
            <Input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium block">Username</label>
            <Input
              v-model="username"
              type="text"
              placeholder="johndoe"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium block">Password</label>
            <Input
              v-model="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium block">Confirm Password</label>
            <Input
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" :loading="isLoading" class="w-full">
            Create account
          </Button>
        </form>
      </Card>

      <p class="text-center text-sm text-muted-foreground mt-4">
        Already have an account?
        <NuxtLink to="/login" class="text-primary hover:underline">
          Sign in
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
