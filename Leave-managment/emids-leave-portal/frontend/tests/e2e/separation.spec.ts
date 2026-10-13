import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

// Validation-only: the flow stops at the "Confirm & notify HR" modal because a
// SUBMITTED separation is HR-visible and has no UI-based undo. Automated
// submission (with service-role cleanup via a valid SUPABASE_SERVICE_ROLE_KEY)
// is deliberately excluded until that key is rotated and provisioned.

test('separation form validates LWD/reason and is guarded by a confirm modal', async ({ page }) => {
  await loginAs(page, 'manager')
  await page.goto('/separation-request')
  await expect(page.getByText('READ BEFORE YOU SUBMIT')).toBeVisible()

  // LWD required
  await page.getByRole('button', { name: /submit separation request/i }).click()
  await expect(page.getByText('Pick your proposed last working day.')).toBeVisible()

  // past LWD rejected
  const past = new Date(); past.setDate(past.getDate() - 1)
  await page.locator('#sep-lwd').fill(past.toISOString().slice(0, 10))
  await page.locator('#sep-reason').selectOption('Career Break')
  await page.getByRole('button', { name: /submit separation request/i }).click()
  await expect(page.getByText('Last working day must be in the future.')).toBeVisible()

  // future LWD opens the confirm modal — then cancel out (no live submission here)
  const future = new Date(); future.setDate(future.getDate() + 90)
  await page.locator('#sep-lwd').fill(future.toISOString().slice(0, 10))
  await page.getByRole('button', { name: /submit separation request/i }).click()
  await expect(page.getByRole('dialog', { name: 'Raise separation request?' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Raise separation request?' })).toBeHidden()
})
