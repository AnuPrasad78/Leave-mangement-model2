// Shared e2e helpers. Specs run against the real FastAPI backend (dev server on :5180)
// plus the compose api on :8000 — mutating specs create-then-clean their own
// rows (see TESTING.md at the repo root).
export const PASSWORD = process.env.SEED_PASSWORD || 'Portal@2026'
export const API_BASE = process.env.E2E_API_BASE_URL || 'http://localhost:8000'
export const ROLES = {
  manager: 'prastina.mary@emids.com',
  staff: 'vikram.deshmukh@emids.com',
  admin: 'admin@emids.com',
}

/** Authenticated FastAPI request context (login sets the HttpOnly session cookie;
 * the request context keeps it and sends it on subsequent calls — no token is
 * ever read back from the response). The explicit Origin header emulates the
 * browser so the backend CSRF origin guard accepts cookie-bearing writes;
 * APIRequestContext does not send Origin on its own. */
export async function apiLogin(request: import('@playwright/test').APIRequestContext, role: keyof typeof ROLES) {
  const login = await request.post(`${API_BASE}/auth/login`, {
    data: { email: ROLES[role], password: PASSWORD },
    failOnStatusCode: false,
  })
  if (!login.ok()) return null
  const headers = { Origin: `http://localhost:5180` }
  return {
    mine: () => request.get(`${API_BASE}/leave-requests/mine`),
    cancel: (requestNo: string) =>
      request.fetch(`${API_BASE}/leave-requests/${requestNo}/cancel`, {
        method: 'POST',
        headers,
        failOnStatusCode: false,
      }),
  }
}

export async function loginAs(
  page: import('@playwright/test').Page,
  role: keyof typeof ROLES = 'manager',
) {
  await page.goto('/login')
  await page.getByPlaceholder('name@emids.com').fill(ROLES[role])
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  // Employees/managers land on /dashboard, admins on /admin (Login role redirect).
  await page.waitForURL(/\/(dashboard|admin)$/, { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.mouse.move(0, 0)
}
