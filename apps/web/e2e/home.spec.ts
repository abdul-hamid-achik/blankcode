import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test('should display the hero section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Master Code')
  })

  test('should navigate to tracks page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Browse Tracks' }).click()
    await expect(page).toHaveURL('/tracks')
  })

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Start Learning' }).click()
    await expect(page).toHaveURL('/register')
  })
})
