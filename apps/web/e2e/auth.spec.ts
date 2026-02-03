import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test('displays login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('shows link to register', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
  })

  test('navigates to register page', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL('/register')
  })
})

test.describe('Register Page', () => {
  test('displays register form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Confirm Password')).toBeVisible()
  })

  test('shows link to login', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  })

  test('validates password match', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Username').fill('testuser')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm Password').fill('different')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Passwords do not match')).toBeVisible()
  })

  test('validates password length', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Username').fill('testuser')
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByLabel('Confirm Password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
  })
})
