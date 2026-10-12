#!/usr/bin/env node
// Manual pixel comparison between tests/.visual-baseline and tests/.visual-after.
// Usage: node tests/e2e/compare-visual.mjs [--threshold 0] [--show-diff]
// A threshold of 0 fails on ANY differing pixel — the zero-visual-change bar.
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const pixelmatch = require('pixelmatch')

const args = process.argv.slice(2)

const dir = dirname(fileURLToPath(import.meta.url))
const BASE = `${dir}/../.visual-baseline`
const AFTER = args.find((a) => a === '--after') ? args[args.indexOf('--after') + 1] : `${dir}/../.visual-after`

const thr = Number((args.find((a) => a === '--threshold') && args[args.indexOf('--threshold') + 1]) ?? 0)

const names = readdirSync(BASE).filter((f) => f.endsWith('.png'))
let mismatches = 0
for (const name of names) {
  const pathA = `${BASE}/${name}`
  const pathB = `${AFTER}/${name}`
  if (!existsSync(pathB)) {
    console.log(`- ${name} missing in after-set`)
    mismatches++
    continue
  }
  const a = PNG.sync.read(readFileSync(pathA))
  const b = PNG.sync.read(readFileSync(pathB))
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`! ${name} size ${a.width}x${a.height} -> ${b.width}x${b.height}`)
    mismatches++
    continue
  }
  const diff = new PNG({ width: a.width, height: a.height })
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: thr })
  if (n === 0) console.log(`= ${name} identical`)
  else {
    console.log(`x ${name}: ${n} differing pixels`)
    if (args.includes('--show-diff')) writeFileSync(`${AFTER}/diff-${name}`, PNG.sync.write(diff))
    mismatches++
  }
}
console.log(mismatches === 0 ? '\nVISUAL PARITY ✓' : `\n${mismatches} shot(s) differ`)
process.exitCode = mismatches === 0 ? 0 : 1
