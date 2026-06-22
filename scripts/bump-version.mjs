#!/usr/bin/env node
/**
 * Synchronized version bumper for the Selecto monorepo.
 *
 * Usage:
 *   node scripts/bump-version.mjs patch   → 1.0.0 → 1.0.1
 *   node scripts/bump-version.mjs minor   → 1.0.0 → 1.1.0
 *   node scripts/bump-version.mjs major   → 1.0.0 → 2.0.0
 *
 * Bumps the version in all package.json files and the chrome extension manifest.json
 */

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const FILES_TO_BUMP = [
  'package.json',
  'apps/chrome-extension/package.json',
  'apps/dashboard/package.json',
  'packages/selector-sdk/package.json',
  'packages/onboarding-sdk/package.json',
  'apps/chrome-extension/manifest.json'
]

const level = process.argv[2]
if (!['patch', 'minor', 'major'].includes(level)) {
  console.error('Usage: node scripts/bump-version.mjs <patch|minor|major>')
  process.exit(1)
}

// Read current version from root package.json
const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const current = rootPkg.version
const [major, minor, patch] = current.split('.').map(Number)

let next
switch (level) {
  case 'major':
    next = `${major + 1}.0.0`
    break
  case 'minor':
    next = `${major}.${minor + 1}.0`
    break
  case 'patch':
    next = `${major}.${minor}.${patch + 1}`
    break
}

console.log(`\n🔄 Bumping version: ${current} → ${next}\n`)

for (const rel of FILES_TO_BUMP) {
  const abs = resolve(root, rel)
  try {
    const raw = readFileSync(abs, 'utf8')
    const parsed = JSON.parse(raw)
    const old = parsed.version
    parsed.version = next

    // Preserve original formatting (detect indent)
    const indent = raw.match(/^(\s+)"/m)?.[1] ?? '  '
    writeFileSync(abs, JSON.stringify(parsed, null, indent) + '\n', 'utf8')

    console.log(`  ✅ ${rel}  ${old} → ${next}`)
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`  ⏭️  ${rel}  (not found, skipping)`)
    } else {
      console.error(`  ❌ ${rel}  ${err.message}`)
    }
  }
}

// Synchronize selector-sdk.js to apps/chrome-extension/
try {
  copyFileSync(
    resolve(root, 'packages/selector-sdk/selector-sdk.js'),
    resolve(root, 'apps/chrome-extension/selector-sdk.js')
  )
  console.log('  📋 Synchronized selector-sdk.js copy to apps/chrome-extension/')
} catch (err) {
  console.error(`  ❌ Failed to copy selector-sdk.js: ${err.message}`)
}

console.log(`\n✨ Done! All packages and manifests are now at version ${next}`)
console.log('   Remember to commit and tag: git tag v' + next + '\n')
