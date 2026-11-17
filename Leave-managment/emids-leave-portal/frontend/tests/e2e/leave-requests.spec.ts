import { test, expect, request as playwrightRequest } from '@playwright/test'
import { loginAs, PASSWORD, ROLES, apiLogin } from './fixtures'

// Decisions are irreversible on the DB level (the trigger only moves
// Pending → Approved/Rejected), so this spec decides ONLY requests created
// inside the test. Creating one needs the staff account; if it is missing the
// spec skips instead of mutating seeded data.
//
// Cleanup contract: leftover Pending requests from earlier aborted runs are
// cancelled through the API before the run, the booking window avoids dates
// already covered by an active request (Approved leftovers are irreversible),
// and a finally block cancels whatever this run left Pending.
test('manager approves a freshly raised staff request', async ({ page }) => {
  const apiCtx = await playwrightRequest.newContext()
  const staffApi = await apiLogin(apiCtx, 'staff')
  test.skip(!staffApi, 'staff e2e account is not provisioned in this project yet')

  // probe: is the staff account live in this project?
  await page.goto('/login')
  await page.getByPlaceholder('name@emids.com').fill(ROLES.staff)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForTimeout(3000)
  test.skip(!page.url().includes('/dashboard'), 'staff e2e account is not provisioned in this project yet')

  const active = await staffApi!.mine().then((r) => r.json() as Promise<{ status: string; start_date: string; end_date: string; request_no: string; reason: string }[]>)

  // API cleanup: cancel any Pending [e2e] rows a previously aborted run left.
  let leftover = false
  for (const r of active.filter((r) => r.status === 'Pending' && r.reason.includes('[e2e]'))) {
    const res = await staffApi!.cancel(r.request_no)
    leftover = Boolean(await res.json())
  }
  test.info().annotations.push({ type: 'cleanup', description: leftover ? 'leftover Pending [e2e] rows cancelled via API' : 'no leftovers' })

  // Booking window: staff books ~2 weeks out on business days, skipping any
  // window that overlaps an active (usually Approved, irreversible) request.
  // Compared as plain YYYY-MM-DD strings — the rule the backend's exclusion
  // constraint applies (Date-instant math previously let windows touching an
  // Approved row on a shared boundary day slip through and then 409 in the DB).
  const live = active.filter((r) => r.status === 'Pending' || r.status === 'Approved')
  const overlapping = (aSpec: string, bSpec: string) =>
    live.some((r) => aSpec <= r.end_date && bSpec >= r.start_date)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  let probe = 0
  let d1 = new Date()
  let d2 = new Date()
  do {
    probe += 1
    d1 = new Date()
    d1.setDate(d1.getDate() + probe * 7)
    while (d1.getDay() === 0 || d1.getDay() === 6) d1.setDate(d1.getDate() + 1)
    d2 = new Date(d1)
    d2.setDate(d1.getDate() + 2)
  } while (overlapping(iso(d1), iso(d2)))
  const reason = `[e2e] approval-cycle request ${iso(d1)}`

  // staff raises a request
  await page.goto('/apply-leave')
  const submitted = page.waitForResponse((r) => r.url().endsWith('/leave-requests') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Paid Time Off' }).click()
  await page.locator('#lv-from').fill(iso(d1))
  await page.locator('#lv-to').fill(iso(d2))
  await page.locator('#lv-reason').fill(reason)
  await page.getByRole('button', { name: /submit request/i }).click()
  const submitRes = await submitted
  expect(submitRes.status()).toBe(201)
  const { request_no: requestNo } = (await submitRes.json()) as { request_no: string }
  await page.waitForURL('**/leave-details', { timeout: 20000 })

  try {
    // manager works the queue — staff must be signed out first
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('button', { name: /log out/i }).click()
    await page.waitForURL('**/login', { timeout: 10000 })
    await loginAs(page, 'manager')
    await page.goto('/leave-requests')

    // The queue is intentionally a Pending-only board: the approved request
    // leaves the list, so approval is verified through (a) the success
    // notification, (b) removal from the Pending queue, and (c) the Approved
    // status on the staff member's own leave-details history.
    const row = page.locator('tr', { hasText: reason }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await expect(row).toContainText('Pending')
    await row.getByRole('button', { name: 'APPROVE' }).click()
    await expect(page.getByText('Request approved')).toBeVisible()
    await expect(row).toHaveCount(0, { timeout: 10000 })

    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('button', { name: /log out/i }).click()
    await page.waitForURL('**/login', { timeout: 10000 })
    await loginAs(page, 'staff')
    await page.goto('/leave-details')
    await expect(page.locator('tr', { hasText: reason }).first()).toContainText('Approved', { timeout: 10000 })
  } finally {
    // Safety net: if anything above failed while the request is still Pending,
    // cancel it through the API so a retry isn't boxed out by the overlap rule.
    const fresh = await staffApi!.mine().then((r) => r.json() as Promise<{ status: string; request_no: string }[]>)
    for (const r of fresh.filter((r) => r.request_no === requestNo && r.status === 'Pending')) {
      await staffApi!.cancel(r.request_no)
    }
  }
  await apiCtx.dispose()
})