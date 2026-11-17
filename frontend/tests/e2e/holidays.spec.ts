import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

// Reversible round-trip: pick one optional holiday, verify the meter, unpick it.
// Leaves the hosted DB exactly as it was. The insert/delete responses are bound
// explicitly so assertions never race the optimistic UI update.
test('manager picks an optional holiday, sees the meter update, then reverts', async ({ page }) => {
  await loginAs(page, 'manager')
  await page.goto('/holidays')
  await expect(page.locator('.hl-panel-head').first()).toContainText('Fixed holidays ·')

  const meter = page.locator('.hl-meter')
  await expect(meter).toContainText(/\d \/ 3/, { timeout: 10000 })
  const before = (await meter.innerText()).trim()

  test.skip(await page.locator('.opt-choice.is-on').count() >= 3, 'optional picks are already full (3/3) for this account — make room manually first')

  const beforeCount = Number(before.match(/CHOSEN (\d+)/)?.[1] ?? '0')

  await page.locator('.opt-choice:not(.is-on)').first().click()
  const reader = page.waitForResponse((r) => r.url().includes('optional_holiday_picks') && r.request().method() === 'POST')
  await expect((await reader).ok()).toBe(true)
  await expect(meter).toContainText(String(beforeCount + 1), { timeout: 8000 })

  await page.locator('.opt-choice.is-on').first().click()
  const deleter = page.waitForResponse((r) => r.url().includes('optional_holiday_picks') && r.request().method() === 'DELETE')
  await expect((await deleter).ok()).toBe(true)
  await expect(meter).toContainText(String(beforeCount), { timeout: 8000 })
})
