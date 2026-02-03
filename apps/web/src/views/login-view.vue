<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import Card from '@/components/ui/card.vue'

const router = useRouter()
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
    router.push('/dashboard')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="container py-12">
    <div class="max-w-md mx-auto">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold">Welcome back</h1>
        <p class="text-muted-foreground mt-1">Sign in to continue learning</p>
      </div>

      <Card>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="error" class="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded">
            {{ error }}
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">Email</label>
            <Input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">Password</label>
            <Input
              v-model="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" :loading="isLoading" class="w-full">
            Sign in
          </Button>
        </form>
      </Card>

      <p class="text-center text-sm text-muted-foreground mt-4">
        Don't have an account?
        <RouterLink to="/register" class="text-primary hover:underline">
          Sign up
        </RouterLink>
      </p>
    </div>
  </div>
</template>
