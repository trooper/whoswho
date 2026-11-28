#!/usr/bin/env node
// A throwaway demo board: fresh sample data in ./demo.sqlite, served on port
// 3001 (DEMO_PORT to change). The real board (npm start, ./whoswho.sqlite)
// is never touched, so it stays empty until guests join.

import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = 'demo.sqlite';
const PORT = process.env.DEMO_PORT || '3001';

const seed = spawnSync(process.execPath, ['scripts/seed.mjs', '--clear', '--db', DB], { cwd: root, stdio: 'inherit' });
if (seed.status !== 0) process.exit(seed.status ?? 1);

console.log(`\n  DEMO DATA, port ${PORT}. The real board is \`npm start\`.`);
const server = spawn(process.execPath, ['server.js'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DB_PATH: DB, PORT },
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));
