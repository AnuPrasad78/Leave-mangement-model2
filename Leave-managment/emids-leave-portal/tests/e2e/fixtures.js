// Shared e2e helpers. Tests run against the real hosted Supabase project —
// mutating specs create-then-clean their own rows (see testing notes in CLAUDE.md).
export const PASSWORD = process.env.SEED_PASSWORD || 'Portal@2026'
export const ROLES = {
  manager: 'sai.nithinreddy@emids.com',
  staff: 'vikram.deshmukh@emids.com',
}

export async function loginAs(page, role = 'manager') {
  await page.goto('/login')
  await page.getByPlaceholder('name@emids.com').fill(ROLES[role])
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.mouse.move(0, 0)
}
