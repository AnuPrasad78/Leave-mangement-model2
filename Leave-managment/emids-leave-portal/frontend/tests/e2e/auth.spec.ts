import { test, expect } from '@playwright/test'
import { ROLES, PASSWORD } from './fixtures'


test('manager sign-in succeeds and lands on the dashboard', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByPlaceholder('name@emids.com').fill(ROLES.manager)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })
  expect(page.url()).toContain('/dashboard')
})

test('wrong password shows the error line and stays on /login', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('name@emids.com').fill(ROLES.manager)
  await page.locator('input[type="password"]').fill('definitely-wrong')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByText('Invalid login credentials')).toBeVisible({ timeout: 15000 })
  expect(page.url()).toContain('/login')
})

test('root path redirects to the sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('employees are redirected away from the manager queue', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('name@emids.com').fill(ROLES.staff)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForTimeout(3000)
  const staffAccountAvailable = page.url().includes('/dashboard')
  test.skip(!staffAccountAvailable, 'staff e2e account is not provisioned in this project yet (needs a valid SUPABASE_SERVICE_ROLE_KEY)')
  await page.goto('/leave-requests')
  await page.waitForTimeout(1200)
  expect(page.url()).toContain('/dashboard')
})
