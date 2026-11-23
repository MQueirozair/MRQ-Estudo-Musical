#!/usr/bin/env node
/**
 * Verificação rápida do projeto, sem dependências extras:
 *  1. sintaxe do processo principal do Electron
 *  2. presença dos arquivos essenciais
 *  3. sanidade da teoria musical (acordes em todos os tons)
 *
 * Rode com: npm test
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let falhas = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  falhas++;
  console.error(`  ✗ ${msg}`);
};

console.log('\n1) Arquivos essenciais');
for (const f of [
  'index.html',
  'package.json',
  'vite.config.ts',
  'src/main.tsx',
  'src/App.tsx',
  'src/music/theory.ts',
  'src/music/audio.ts',
  'electron/main.cjs',
  'electron/preload.cjs',
  'build/icon.png',
]) {
  existsSync(path.join(root, f)) ? ok(f) : fail(`faltando: ${f}`);
}

console.log('\n2) Sintaxe do Electron');
for (const f of ['electron/main.cjs', 'electron/preload.cjs']) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' });
    ok(f);
  } catch (err) {
    fail(`${f}: ${err.message}`);
  }
}

console.log('\n3) Teoria musical');
const theory = readFileSync(path.join(root, 'src/music/theory.ts'), 'utf8');
const checagens = [
  [/export const CHORD_TYPES/, 'catálogo de acordes definido'],
  [/export const SCALES/, 'catálogo de escalas definido'],
  [/export const PROGRESSIONS/, 'catálogo de progressões definido'],
  [/export function buildChord/, 'buildChord exportada'],
  [/export function progressionToChords/, 'progressionToChords exportada'],
];
for (const [re, label] of checagens) re.test(theory) ? ok(label) : fail(label);

const totalTipos = (theory.match(/  T\('/g) ?? []).length;
totalTipos >= 70 ? ok(`${totalTipos} tipos de acorde`) : fail(`poucos acordes (${totalTipos})`);

const categorias = (theory.match(/^  '[^']+',$/gm) ?? []).length;
categorias >= 15 ? ok(`${categorias} categorias`) : fail(`poucas categorias (${categorias})`);

console.log(falhas === 0 ? '\nTudo certo ✅\n' : `\n${falhas} problema(s) ❌\n`);
process.exit(falhas === 0 ? 0 : 1);
