import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './fixtures'

// Backend validation is authoritative — these payloads are exactly what a
// tampered frontend could send through the same-origin /api BFF proxy.
const OPTIONAL_TYPE = 'Optional Holiday'

function isoPlus(page: Page, offsetDays: number): Promise<string> {
  return page.evaluate((offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${month}-${day}`
  }, offsetDays)
}

async function postRequest(page: Page, body: Record<string, unknown>): Promise<{ status: number; detail: string | null }> {
  const cookies = await page.context().cookies()
  const csrf = cookies.find((c) => c.name === 'lp_csrf')?.value ?? ''
  const response = await page.request.post('/api/leave-requests', {
    headers: { 'X-CSRF-Token': csrf },
    data: body,
  })
  const payloads = (await response.json()) as Record<string, unknown>
  return {
    status: response.status(),
    detail: typeof payloads.detail === 'string' ? payloads.detail : null,
  }
}

const optionalBody = (from: string, to: string) => ({
  type: OPTIONAL_TYPE,
  from,
  to,
  days: 1,
  mode: 'Full Day',
  reason: '[e2e] optional holiday api guard',
})

test('backend rejects an optional holiday on an unconfigured date even without the UI', async ({ page }) => {
  await loginAs(page, 'staff')
  const from = await isoPlus(page, 90) // ordinary future weekday, not a configured optional holiday
  const body = { ...optionalBody(from, from), requestedOn: await isoPlus(page, 0) }

  const result = await postRequest(page, body)

  expect(result.status).toBe(422)
  expect(result.detail).toContain('not a configured optional holiday')
})

test('backend rejects a past configured optional holiday', async ({ page }) => {
  await loginAs(page, 'staff')
  const body = { ...optionalBody('2025-08-08', '2025-08-08'), requestedOn: await isoPlus(page, 0) }

  const result = await postRequest(page, body)

  expect(result.status).toBe(422)
  expect(result.detail).toContain('past date')
})

test('backend rejects a multi-day Optional Holiday request', async ({ page }) => {
  await loginAs(page, 'staff')
  const from = await isoPlus(page, 40)
  const to = await isoPlus(page, 44)
  const body = { ...optionalBody(from, to), days: 5, requestedOn: await isoPlus(page, 0) }

  const result = await postRequest(page, body)

  expect(result.status).toBe(422)
  expect(result.detail).toContain('single full-day')
})

test('apply an optional holiday end-to-end: gating, remaining count, submit, cancel', async ({ page }) => {
  await loginAs(page, 'staff')

  // Self-heal from an interrupted previous run: cancel stale [e2e] rows.
  const staleRows = page.locator('tr', { hasText: '[e2e] optional holiday' }).filter({ hasText: 'Pending' })
  while ((await staleRows.count()) > 0) {
    await page.goto('/leave-details')
    await staleRows.first().getByRole('button', { name: 'Cancel request' }).click()
    await page.getByRole('button', { name: 'Cancel request', exact: true }).last().click()
    await page.locator('tr', { hasText: '[e2e] optional holiday' }).first()
      .filter({ hasText: 'Cancelled' }).waitFor({ timeout: 10000 })
  }

  await page.goto('/apply-leave')
  await page.getByRole('button', { name: OPTIONAL_TYPE }).click()
  await expect(page.getByRole('group', { name: 'Optional holiday picker' })).toBeVisible()

  // The allowance line comes from the backend policy constants.
  await expect(page.getByText(/Remaining: 3 out of 3 Optional Holidays/)).toBeVisible()

  // Ordinary upcoming dates stay disabled; only configured optional holidays enable.
  const tomorrow = await isoPlus(page, 1)
  await expect(page.getByRole('button', { name: tomorrow })).toBeDisabled()

  // Find the first selectable (configured, future) day in the picker.
  let dateISO: string | null = null
  for (let hop = 0; hop <= 8 && !dateISO; hop++) {
    if (hop > 0) await page.getByRole('button', { name: 'Next month' }).click()
    const active = page.locator('.opt-calendar__day--picked:not([disabled])').first()
    if (await active.count()) dateISO = ((await active.getAttribute('aria-label')) ?? '').slice(0, 10)
  }
  if (!dateISO) test.skip(true, 'No configured future optional holiday available in this environment')

  // The search stops as soon as the picked day is in view, so it is on screen.
  await page.getByRole('button', { name: new RegExp(`^${dateISO} — `) }).click()
  await expect(page.getByText(/^Selected/)).toContainText('1 day')

  await page.locator('#lv-reason').fill(`[e2e] optional holiday ${dateISO}`)
  await page.getByRole('button', { name: /submit request/i }).click()
  await page.waitForURL('**/leave-details', { timeout: 20000 })

  const row = page.locator('tr', { hasText: `[e2e] optional holiday ${dateISO}` }).first()
  await expect(row).toContainText('Pending')

  // A successful application consumed one allowance slot. The line beside the
  // type tracks the year of the picked date, so select it again to see it.
  const reselectPickedDay = async () => {
    await page.goto('/apply-leave')
    await page.getByRole('button', { name: OPTIONAL_TYPE }).click()
    await expect(page.getByRole('group', { name: 'Optional holiday picker' })).toBeVisible()
    for (let hop = 0; hop <= 8; hop++) {
      if (hop > 0) await page.getByRole('button', { name: 'Next month' }).click()
      const active = page.locator('.opt-calendar__day--picked:not([disabled])').first()
      if (await active.count()) break
    }
    await page.getByRole('button', { name: new RegExp(`^${dateISO} — `) }).click()
  }
  await reselectPickedDay()
  await expect(page.getByText(/Remaining: 2 out of 3 Optional Holidays/)).toBeVisible()

  // Clean up: cancel the [e2e] request, and the allowance returns.
  await page.goto('/leave-details')
  await row.getByRole('button', { name: 'Cancel request' }).click()
  await expect(page.getByRole('dialog', { name: 'Cancel this request?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel request', exact: true }).last().click()
  await expect(page.getByText('Request cancelled')).toBeVisible()

  await reselectPickedDay()
  await expect(page.getByText(/Remaining: 3 out of 3 Optional Holidays/)).toBeVisible()
})
