import { test, expect } from '@playwright/test'

test('root redirects to the sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('button', { name: 'SIGN IN' })).toBeVisible()
})
