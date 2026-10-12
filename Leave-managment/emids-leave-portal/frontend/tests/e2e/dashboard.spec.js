import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

test('manager dashboard renders balance meters, quick actions and support panel', async ({ page }) => {
  await loginAs(page, 'manager')
  await expect(page.locator('.donut')).toBeVisible()
  await expect(page.getByText('ANNUAL POOL · AS OF TODAY')).toBeVisible()
  const bars = page.locator('.bar-row')
  expect(await bars.count()).toBeGreaterThan(3)
  await expect(page.locator('.dash-actions .action-card').first()).toBeVisible()
  await expect(page.getByText('Support Centre')).toBeVisible()
})

test('active navigation highlights and drawer counts show annual/contingency pools', async ({ page }) => {
  await loginAs(page, 'manager')
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.locator('.drawer__counts .drawer__count').first()).toContainText('Annual leave')
  await expect(page.locator('.drawer__counts .drawer__count').nth(1)).toContainText('Contingency')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const hidden = await page.locator('.drawer').evaluate((el) => getComputedStyle(el).visibility)
  expect(hidden).toBe('hidden')
})

test('profile menu opens with employee details and closes on Escape', async ({ page }) => {
  await loginAs(page, 'manager')
  await page.getByRole('button', { name: /my profile/i }).click()
  await expect(page.locator('.profile-pop')).toBeVisible()
  await expect(page.locator('.profile-pop__name')).not.toBeEmpty()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await expect(page.locator('.profile-pop')).toBeHidden()
})
