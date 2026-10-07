import { test, expect } from '@playwright/test'
import { loginAs, PASSWORD, ROLES } from './fixtures'

// Decisions are irreversible on the DB level (the trigger only moves
// Pending → Approved/Rejected), so this spec decides ONLY requests created
// inside the test. Creating one needs the staff account; if it is missing the
// spec skips instead of mutating seeded data.
test('manager approves a freshly raised staff request', async ({ page }) => {
  await page.goto('/login')
  // probe: is the staff account live in this project?
  await page.getByPlaceholder('name@emids.com').fill(ROLES.staff)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForTimeout(3000)
  test.skip(!page.url().includes('/dashboard'), 'staff e2e account is not provisioned in this project yet')

  // staff raises a request
  await page.goto('/apply-leave')
  const iso = (d) => d.toISOString().slice(0, 10)
  const d1 = new Date(); d1.setDate(d1.getDate() + 14); while (d1.getDay() === 0 || d1.getDay() === 6) d1.setDate(d1.getDate() + 1)
  const d2 = new Date(d1); d2.setDate(d1.getDate() + 2)
  const reason = `[e2e] approval-cycle request ${d1.toISOString().slice(0, 10)}`
  await page.getByRole('button', { name: 'Paid Time Off' }).click()
  await page.locator('#lv-from').fill(iso(d1))
  await page.locator('#lv-to').fill(iso(d2))
  await page.getByRole('textbox').fill(reason)
  await page.getByRole('button', { name: /submit request/i }).click()
  await page.waitForURL('**/leave-details', { timeout: 20000 })

  // manager works the queue — staff must be signed out first
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: /log out/i }).click()
  await page.waitForURL('**/login', { timeout: 10000 })
  await loginAs(page, 'manager')
  await page.goto('/leave-requests')

  const row = page.locator('tr', { hasText: reason }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  await expect(row).toContainText('Pending')
  await row.getByRole('button', { name: 'APPROVE' }).click()
  await expect(page.getByText('Request approved')).toBeVisible()
  await expect(row).toContainText('Approved', { timeout: 10000 })

  // drift note: this approval increments the staff member's balances —
  // re-seed (supabase/seed.sql) resets everything back.
})
