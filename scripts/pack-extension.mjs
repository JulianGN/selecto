#!/usr/bin/env node
/**
 * Empacotador oficial da extensão Chrome do Selecto.
 *
 * Gera o arquivo apps/chrome-extension/selecto.zip pronto para submissão
 * na Chrome Web Store, contendo apenas os arquivos estritamente necessários.
 *
 * Suporta incremento automático de versão antes de empacotar:
 *   node scripts/pack-extension.mjs              → empacota versão atual
 *   node scripts/pack-extension.mjs patch        → bump patch + empacota
 *   node scripts/pack-extension.mjs minor        → bump minor + empacota
 *   node scripts/pack-extension.mjs major        → bump major + empacota
 *
 * Via npm:
 *   npm run pack:extension
 *   npm run pack:extension -- patch (ou bump-patch)
 *   npm run pack:extension:patch
 *   npm run pack:extension:minor
 */

import { existsSync, unlinkSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { bumpVersion, normalizeBumpLevel } from './bump-version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const extDir = resolve(root, 'apps/chrome-extension');
const zipFile = resolve(extDir, 'selecto.zip');

// 1. Verificar se foi passado parâmetro de bump de versão (ex: patch, minor, major, bump-patch, etc.)
const bumpArg = process.argv.slice(2).find(arg => normalizeBumpLevel(arg) !== null);

if (bumpArg) {
  const level = normalizeBumpLevel(bumpArg);
  console.log(`🔼 Parâmetro de versão detectado ("${bumpArg}"). Atualizando versão para "${level}"...`);
  bumpVersion(level);
}

console.log('📦 Empacotando extensão Selecto para Chrome Web Store...\n');

// 2. Sincronizar selector-sdk.js mais recente
const sdkSource = resolve(root, 'packages/selector-sdk/selector-sdk.js');
const sdkDest = resolve(extDir, 'selector-sdk.js');
if (existsSync(sdkSource)) {
  copyFileSync(sdkSource, sdkDest);
  console.log('  ✅ selector-sdk.js sincronizado.');
} else {
  console.warn('  ⚠️ Aviso: packages/selector-sdk/selector-sdk.js não encontrado.');
}

// 3. Ler versão do manifest.json
const manifestPath = resolve(extDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
console.log(`  🔖 Versão do manifest.json: v${manifest.version}`);

// 4. Remover zip antigo se existir
if (existsSync(zipFile)) {
  unlinkSync(zipFile);
  console.log('  🗑️  Zip anterior removido.');
}

// 5. Lista dos arquivos/pastas estritamente necessários para a loja
const filesToPack = [
  'manifest.json',
  'background.js',
  'content.js',
  'selector-sdk.js',
  'popup.html',
  'popup.css',
  'popup.js',
  '_locales',
  'icon-16.png',
  'icon-48.png',
  'icon-128.png',
  'icon-active-16.png',
  'icon-active-48.png',
  'icon-active-128.png',
  'LICENSE'
];

// Validar se todos os arquivos existem antes de empacotar
for (const file of filesToPack) {
  const filePath = resolve(extDir, file);
  if (!existsSync(filePath)) {
    console.error(`  ❌ Arquivo obrigatório não encontrado: ${file}`);
    process.exit(1);
  }
}

// 6. Gerar arquivo ZIP via PowerShell Compress-Archive (sem barra de progresso no console)
const pathsList = filesToPack.map(f => `'${f}'`).join(',');
const powershellCmd = `powershell -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Set-Location -Path '${extDir}'; Compress-Archive -Path ${pathsList} -DestinationPath '${zipFile}' -Force"`;

try {
  execSync(powershellCmd, { stdio: 'inherit' });
  console.log(`\n🎉 Pacote v${manifest.version} gerado com sucesso:`);
  console.log(`   ${zipFile}`);
  console.log(`   Pronto para upload no Chrome Developer Dashboard!\n`);
} catch (error) {
  console.error('\n❌ Falha ao compactar os arquivos:', error.message);
  process.exit(1);
}
