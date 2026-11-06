#!/usr/bin/env node
// Manual visual baseline capture (not part of the playwright test suite).
// Boots the dev server on :5180, signs in through the real login form per role,
// and screenshots every route at 1440x900 into tests/.visual-baseline/ or
// tests/.visual-after/.
//
// Usage: node tests/e2e/screenshot-visual.mjs [--out tests/.visual-after] [--keep-server]

import { spawn, execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const keepServer = args.includes('--keep-server')

const BASE = 'http://localhost:5180'
const OUT = arg('out', 'tests/.visual-baseline')
const wantRoles = arg('roles', 'manager,staff').split(',').filter(Boolean)
const PASSWORD = process.env.SEED_PASSWORD || 'Portal@2026'
const ROLES = Object.fromEntries(
  Object.entries({
    manager: 'sai.nithinreddy@emids.com',
    staff: 'vikram.deshmukh@emids.com',
  }).filter(([role]) => wantRoles.includes(role))
)
const ROUTES = ['/dashboard', '/apply-leave', '/leave-details', '/leave-requests', '/holidays', '/separation-request']

async function ensureServer() {
  try {
    const res = await fetch(`${BASE}/`)
    if (res.ok) return null
  } catch { /* offline */ }
  const child = spawn('npm', ['run', 'dev', '--', '--port', '5180', '--strictPort'], {
    shell: true,
    stdio: 'ignore',
    detached: true,
  })
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/`)
      if (res.ok) return child
    } catch { /* server not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('dev server did not start on :5180')
}

async function login(page, email) {
  await page.goto(`${BASE}/login`)
  await page.getByPlaceholder('name@emids.com').fill(email)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })
  await page.waitForLoadState('networkidle')
}

async function shot(page, name) {
  await page.waitForLoadState('networkidle')
  // park the cursor away from interactive elements so :hover styles don't leak
  // into captures, then let entrance animations settle
  await page.mouse.move(0, 0)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`+ ${OUT}/${name}.png`)
}

mkdirSync(OUT, { recursive: true })
const server = await ensureServer()

const browser = await chromium.launch()

try {
  // Sign-out landing page
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/login`)
    await shot(page, 'login')
    await ctx.close()
  }

  for (const [role, email] of Object.entries(ROLES)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await login(page, email)
    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`)
      const name = page.url().replace(`${BASE}/`, '').replace(/\//g, '_') || 'root'
      await shot(page, `${role}-${name.split('?')[0]}`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  if (server && !keepServer) {
    try { execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" }) } catch { /* already gone */ }
  }
}
console.log('\nBaseline set captured.')
