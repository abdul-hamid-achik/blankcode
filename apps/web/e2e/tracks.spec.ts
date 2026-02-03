import { test, expect } from '@playwright/test'

test.describe('Tracks Page', () => {
  test('displays tracks page heading', async ({ page }) => {
    await page.goto('/tracks')
    await expect(page.getByRole('heading', { name: 'Learning Tracks' })).toBeVisible()
  })

  test('shows loading state initially', async ({ page }) => {
    await page.goto('/tracks')
    await expect(page.getByText('Loading tracks...')).toBeVisible()
  })
})

test.describe('Track Detail Page', () => {
  test('displays back link', async ({ page }) => {
    await page.goto('/tracks/typescript')
    await expect(page.getByText('← Back to Tracks')).toBeVisible()
  })

  test('navigates back to tracks', async ({ page }) => {
    await page.goto('/tracks/typescript')
    await page.getByText('← Back to Tracks').click()
    await expect(page).toHaveURL('/tracks')
  })
})
