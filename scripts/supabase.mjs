#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// 1. Cargar .env.local primero (mayor prioridad), luego .env
loadEnvFile('.env.local');
loadEnvFile('.env');

if (!process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_ACCES_TOKEN) {
  process.env.SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCES_TOKEN;
}

if (process.env.SUPABASE_ACCESS_TOKEN) {
  console.log('🔒 [Supabase] Usando SUPABASE_ACCESS_TOKEN configurado para esta carpeta.');
} else {
  console.warn('⚠️  [Supabase] No se encontró SUPABASE_ACCESS_TOKEN en .env.local ni en .env.');
}

const args = process.argv.slice(2);
const candidates = [
  resolve(process.cwd(), 'node_modules', '.bin', 'supabase'),
  '/opt/homebrew/bin/supabase',
  '/usr/local/bin/supabase',
];

let binPath = null;
for (const p of candidates) {
  if (existsSync(p)) {
    binPath = p;
    break;
  }
}

let cmd;
let cmdArgs;

if (binPath) {
  cmd = binPath;
  cmdArgs = args;
} else {
  cmd = 'npx';
  cmdArgs = ['supabase', ...args];
}

const child = spawn(cmd, cmdArgs, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
