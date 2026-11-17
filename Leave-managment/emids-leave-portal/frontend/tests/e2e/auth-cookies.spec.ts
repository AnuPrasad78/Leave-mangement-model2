import { test, expect } from '@playwright/test'
import { API_BASE, PASSWORD, ROLES } from './fixtures'

// Dedicated HttpOnly-cookie session checks at the real-browser level: the JWT
// may only travel in the Set-Cookie of /auth/login and ride automatically on
// subsequent requests; no script-readable copy may exist anywhere.
test('login sets the HttpOnly session cookie and leaves no JWT in web storage', async ({ page }) => {
  await page.goto('/login')
  const loginResponse = page.waitForResponse((r) => r.url().endsWith('/auth/login'))
  await page.getByPlaceholder('name@emids.com').fill(ROLES.manager)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  const login = await loginResponse
  const body = await login.json()
  expect(body).toEqual({ ok: true }) // JWT never in the login body

  await page.waitForURL('**/dashboard', { timeout: 20000 })

  const cookie = (await page.context().cookies())
    .find((c) => c.name === 'leave_portal_session')
  expect(cookie).toBeTruthy()
  expect(cookie!.httpOnly).toBe(true)
  const outside = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }))
  for (const value of [...Object.values(outside.local), ...Object.values(outside.session)]) {
    expect(String(value)).not.toContain(cookie!.value)
  }
})

test('reload keeps the session and the cookie rides on API calls', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('name@emids.com').fill(ROLES.manager)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000) // SigninGuard would have redirected to /login
  expect(page.url()).toContain('/dashboard')

  // page.request shares the browser cookie jar — same-origin request by context
  const me = await page.request.get(`${API_BASE}/employees/me`)
  expect(me.status()).toBe(200)
})

test('logout clears the cookie and a foreign-origin POST is rejected', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('name@emids.com').fill(ROLES.manager)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })

  // CSRF guard: same context (cookie attached), Origin not an allowed frontend
  const forged = await page.request.post(`${API_BASE}/leave-requests/LV-00000/cancel`, {
    headers: { Origin: 'https://evil.example' },
    failOnStatusCode: false,
  })
  expect(forged.status()).toBe(403)
  expect((await forged.json())['detail']).toContain('Cross-site')

  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: /log out/i }).click()
  await page.waitForURL('**/login', { timeout: 10000 })

  expect(await page.evaluate(() => document.cookie)).not.toContain('leave_portal_session=')
  expect(
    (await page.context().cookies()).some((c) => c.name === 'leave_portal_session'),
  ).toBe(false)
  const me = await page.request.get(`${API_BASE}/employees/me`)
  expect(me.status()).toBe(401)
})
