import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

// One full self-service cycle: raise a request marked [e2e], see it in the list,
// then cancel it. Dates sit ~60 days out — the DB enforces request overlap
// exclusion against existing Pending/Approved rows, so near-dates collide.
test('apply for leave end-to-end: validate, submit, review, cancel', async ({ page }) => {
  await loginAs(page, 'manager')
  await page.goto('/apply-leave')

  // client-side validation errors first
  await page.getByRole('button', { name: /submit request/i }).click()
  await expect(page.getByText('Pick a from date.')).toBeVisible()

  const iso = (d) => d.toISOString().slice(0, 10)
  const farMonday = new Date(); farMonday.setDate(farMonday.getDate() + 60)
  while (farMonday.getDay() === 0 || farMonday.getDay() === 6) farMonday.setDate(farMonday.getDate() + 1)
  const farFriday = new Date(farMonday); farFriday.setDate(farMonday.getDate() + 4)
  const reason = `[e2e] automated leave request ${farMonday.toISOString().slice(0, 10)}`

  await page.getByRole('button', { name: 'Paid Time Off' }).click()
  await page.locator('#lv-from').fill(iso(farMonday))
  await page.locator('#lv-to').fill(iso(farFriday))
  await page.locator('#lv-reason').fill(reason)
  await expect(page.getByText(/Selected \d+ days?/)).toContainText('Selected')
  await page.getByRole('button', { name: /submit request/i }).click()

  await page.waitForURL('**/leave-details', { timeout: 20000 })
  await expect(page.getByRole('dialog', { name: /welcome|my profile/i }).first()).toBeHidden()
  const row = page.locator('tr', { hasText: reason }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  await expect(row).toContainText('Pending')
  await expect(row).toContainText('[e2e]')

  // cancel it (danger modal guard)
  await row.getByRole('button', { name: 'Cancel request' }).click()
  await expect(page.getByRole('dialog', { name: 'Cancel this request?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel request', exact: true }).last().click()
  await expect(page.getByText('Request cancelled')).toBeVisible()
  await expect(page.locator('tr', { hasText: reason }).first()).toContainText('Cancelled', { timeout: 10000 })
})

test('inverted date range flags the end-date error', async ({ page }) => {
  await loginAs(page, 'manager')
  await page.goto('/apply-leave')
  const iso = (d) => d.toISOString().slice(0, 10)
  const d1 = new Date(); d1.setDate(d1.getDate() + 10)
  const d0 = new Date(); d0.setDate(d0.getDate() + 5)
  await page.locator('#lv-from').fill(iso(d1))
  await page.locator('#lv-to').fill(iso(d0))
  await page.getByRole('button', { name: /submit request/i }).click()
  await expect(page.getByText('End date is before the start date.')).toBeVisible()
  await expect(page.getByRole('button', { name: /submit request/i })).toBeVisible()
})
