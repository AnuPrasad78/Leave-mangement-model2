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

  const beforeCount = Number(before.match(/CHOSEN\s+(\d+)/)?.[1] ?? '0')

  // Same-holiday round trip tied to the chip's accessible name
  // (aria-label="Choose <holiday>"), not to a mutable position: the chips
  // re-render with new classes during the optimistic update, and picking a
  // different holiday than the one we picked would fail the meter contract.
  const chip = page.locator('.opt-choice:not(.is-on)').first()
  const name = await chip.getAttribute('aria-label')
  test.skip(!name, 'no unpicked optional holiday available for this account/year — make room first')

  const post = page.waitForResponse((r) => r.url().includes('/holidays/picks') && r.request().method() === 'POST')
  await page.getByRole('button', { name, exact: true }).click()
  await expect((await post).ok()).toBe(true)
  await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(meter).toContainText(String(beforeCount + 1), { timeout: 8000 })

  const deleter = page.waitForResponse((r) => r.url().includes('/holidays/picks') && r.request().method() === 'DELETE')
  await page.getByRole('button', { name, exact: true }).click()
  await expect((await deleter).ok()).toBe(true)
  await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(meter).toContainText(String(beforeCount), { timeout: 8000 })
})
