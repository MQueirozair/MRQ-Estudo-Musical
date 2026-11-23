#!/usr/bin/env node
/**
 * Garante que o binário do Electron esteja presente antes do empacotamento.
 *
 * Por que existe: instalar com ELEKTRON_SKIP_BINARY_DOWNLOAD=1 evita falhas de
 * rede durante o `npm ci`, mas deixa `node_modules/electron/dist` vazio — e o
 * electron-builder precisa desse `dist` para montar o app. Aqui fazemos o
 * download uma única vez, com mensagens de erro claras e fallback de espelho.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const distDir = path.join(electronDir, 'dist');
const versionFile = path.join(distDir, 'version');

const version = JSON.parse(readFileSync(path.join(electronDir, 'package.json'), 'utf8')).version;

if (existsSync(versionFile)) {
  console.log(`✓ Electron ${readFileSync(versionFile, 'utf8').trim()} já instalado em ${distDir}`);
  process.exit(0);
}

mkdirSync(distDir, { recursive: true });
const installScript = path.join(electronDir, 'install.js');
if (!existsSync(installScript)) {
  console.error('✗ install.js do Electron não encontrado. Rode `npm ci` novamente.');
  process.exit(1);
}

const mirror = process.env.ELECTRON_MIRROR || 'https://github.com/electron/electron/releases/download/';
console.log(`→ Baixando Electron ${version} (${mirror})`);

try {
  execFileSync(process.execPath, [installScript], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_SKIP_BINARY_DOWNLOAD: '',
      ELECTRON_MIRROR: mirror,
      DEBUG: process.env.DEBUG ?? '',
    },
    timeout: 10 * 60 * 1000,
  });
} catch (err) {
  console.error('\n✗ Falha ao baixar o binário do Electron.');
  console.error('  Verifique a conexão ou defina ELECTRON_MIRROR, por exemplo:');
  console.error('    ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run dist:win');
  process.exit(1);
}

if (!existsSync(versionFile)) {
  writeFileSync(versionFile, version);
}
console.log('✓ Electron pronto para empacotar.');
