import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

const ADMIN_PAGES = ['/admin', '/admin/employees', '/admin/leave-policies', '/admin/audit-logs', '/admin/reminders']

// RBAC gates are client UX; FastAPI fails closed server-side. The browser-level
// contract under test: wrong roles are redirected away from admin and manager
// surfaces; admins reach every page.
test.describe('admin route access', () => {
  test('employees are redirected away from every admin page and the manager queue', async ({ page }) => {
    await loginAs(page, 'staff')
    for (const [label, route] of [['manager queue', '/leave-requests'], ...ADMIN_PAGES.map((r) => [`admin ${r}`, r] as const)]) {
      await page.goto(route)
      await expect(page, label).toHaveURL(/\/dashboard/)
      await expect(page, label).not.toHaveURL(new RegExp(route.replace(/\//g, '\\/') + '$'))
    }
  })

  test('managers reach the manager queue but are redirected away from admin pages', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.goto('/leave-requests')
    await expect(page).toHaveURL(/\/leave-requests$/)
    for (const route of ADMIN_PAGES) {
      await page.goto(route)
      await expect(page, route).toHaveURL(/\/dashboard/)
    }
  })

  test('admin reaches all five admin pages and the manager queue', async ({ page }) => {
    await loginAs(page, 'admin')
    for (const route of ADMIN_PAGES) {
      await page.goto(route)
      await expect(page, route).toHaveURL(new RegExp(route.replace(/\//g, '\\/') + '$'))
      await expect(page.locator('.header__title')).toHaveText('Admin Console')
    }
    await page.goto('/leave-requests')
    await expect(page).toHaveURL(/\/leave-requests$/)
  })
})

// AdminContext mounts once per admin visit and survives admin-to-admin
// navigation (group layout persists). Signal: the plain employee-list boot
// fetch (page_size defaults to 10 and no filters — AdminDashboard's own stats
// use page_size=1 and the search panel page_size=5, both excluded here) fires
// on the first admin page and does NOT re-fire while walking admin pages, but
// fires again after the provider unmounts on the way out of /admin/*.
test('AdminProvider persists across admin-page navigation', async ({ page }) => {
  await loginAs(page, 'admin')
  const bootFetches: string[] = []
  const isBootFetch = (url: URL) =>
    url.pathname === '/admin/employees' &&
    // `?_rsc=` requests are Next <Link> RSC payloads (prefetch/navigation),
    // not employee-list data fetches.
    !url.searchParams.has('_rsc') &&
    !url.searchParams.has('search') &&
    !url.searchParams.has('active') &&
    !url.searchParams.has('role') &&
    (url.searchParams.get('page_size') ?? '10') === '10'
  page.on('request', (r) => {
    let url: URL | null = null
    try { url = new URL(r.url(), 'http://localhost:5180') } catch { /* non-absolute scheme */ }
    if (r.method() === 'GET' && url && isBootFetch(url)) {
      bootFetches.push(`${new URL(page.url()).pathname} <- ${url.pathname}${url.search}`)
    }
  })

  await page.goto('/admin')
  await expect.poll(async () => bootFetches.length, { timeout: 10000 }).toBeGreaterThanOrEqual(1)
  // Dev servers run React StrictMode, which double-invokes mount effects —
  // so the boot fires 1-2 times per mount. Lock in the settled count.
  await page.waitForTimeout(500)
  const bootCount = bootFetches.length

  // Walk via the drawer nav (client-side navigation — page.goto would reload
  // the document and remount everything, which is not the UX contract under
  // test): the group layout must persist between admin pages.
  async function openDrawerAndClick(label: string) {
    await expect(page.locator('.drawer')).toBeHidden()
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await expect(page.locator('.drawer')).toBeVisible()
    await page.locator('.drawer').getByText(label, { exact: true }).click()
    await expect(page.locator('.header__title')).toHaveText('Admin Console')
    await expect(page.locator('.drawer')).toBeHidden()
  }
  await openDrawerAndClick('Admin · Employees')
  await openDrawerAndClick('Admin · Balances')
  await openDrawerAndClick('Admin · Audit Logs')
  await openDrawerAndClick('Admin · Stale & Nudges')
  await openDrawerAndClick('Admin · Console')
  // The group layout (and AdminProvider) persisted: no new boot fetches.
  expect(bootFetches.length).toBe(bootCount)

  // Leaving /admin/* unmounts the group layout; re-entering boots again.
  await page.goto('/dashboard')
  await page.waitForTimeout(300)
  await page.goto('/admin/employees')
  await expect.poll(async () => bootFetches.length, { timeout: 10000 }).toBeGreaterThan(bootCount)
})
