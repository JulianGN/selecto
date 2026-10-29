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

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

export const FILES_TO_BUMP = [
  'package.json',
  'apps/chrome-extension/package.json',
  'apps/dashboard/package.json',
  'apps/website/package.json',
  'packages/core/package.json',
  'packages/selector-sdk/package.json',
  'packages/onboarding-sdk/package.json',
  'packages/ui/package.json',
  'apps/chrome-extension/manifest.json'
];

/**
 * Normaliza o parâmetro de nível de bump.
 * Aceita: patch, bump-patch, --patch, minor, bump-minor, major, etc.
 */
export function normalizeBumpLevel(arg) {
  if (!arg) return null;
  const clean = String(arg).toLowerCase().replace(/^--?/, '').replace(/^bump[-_]?/, '');
  if (['patch', 'minor', 'major'].includes(clean)) {
    return clean;
  }
  return null;
}

/**
 * Incrementa a versão em todos os pacotes e sincroniza o SDK.
 * @param {'patch' | 'minor' | 'major'} level
 * @returns {{ current: string, next: string }}
 */
export function bumpVersion(level) {
  const normLevel = normalizeBumpLevel(level);
  if (!normLevel) {
    throw new Error(`Nível de versão inválido: "${level}". Use "patch", "minor" ou "major".`);
  }

  // Read current version from root package.json
  const rootPkgPath = resolve(root, 'package.json');
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  const current = rootPkg.version;
  const [major, minor, patch] = current.split('.').map(Number);

  let next;
  switch (normLevel) {
    case 'major':
      next = `${major + 1}.0.0`;
      break;
    case 'minor':
      next = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      next = `${major}.${minor}.${patch + 1}`;
      break;
  }

  console.log(`\n🔄 Bumping version: ${current} → ${next}\n`);

  for (const rel of FILES_TO_BUMP) {
    const abs = resolve(root, rel);
    try {
      const raw = readFileSync(abs, 'utf8');
      const parsed = JSON.parse(raw);
      const old = parsed.version;
      parsed.version = next;

      // Preserve original formatting (detect indent)
      const indent = raw.match(/^(\s+)"/m)?.[1] ?? '  ';
      writeFileSync(abs, JSON.stringify(parsed, null, indent) + '\n', 'utf8');

      console.log(`  ✅ ${rel}  ${old} → ${next}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`  ⏭️  ${rel}  (not found, skipping)`);
      } else {
        console.error(`  ❌ ${rel}  ${err.message}`);
      }
    }
  }

  // Synchronize selector-sdk.js to apps/chrome-extension/
  try {
    copyFileSync(
      resolve(root, 'packages/selector-sdk/selector-sdk.js'),
      resolve(root, 'apps/chrome-extension/selector-sdk.js')
    );
    console.log('  📋 Synchronized selector-sdk.js copy to apps/chrome-extension/');
  } catch (err) {
    console.error(`  ❌ Failed to copy selector-sdk.js: ${err.message}`);
  }

  console.log(`\n✨ Done! All packages and manifests are now at version ${next}`);
  console.log('   Remember to commit and tag: git tag v' + next + '\n');

  return { current, next };
}

// Execução direta via CLI: node scripts/bump-version.mjs <patch|minor|major>
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const rawLevel = process.argv[2];
  const level = normalizeBumpLevel(rawLevel);
  if (!level) {
    console.error('Usage: node scripts/bump-version.mjs <patch|minor|major>');
    process.exit(1);
  }
  bumpVersion(level);
}
