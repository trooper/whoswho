// Static files for the Worker: public/ plus three.js, into dist/public.
// (On Node, server.js serves these straight from public/ and node_modules.)

import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist', 'public');
rmSync(OUT, { recursive: true, force: true });
cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
mkdirSync(path.join(OUT, 'vendor'), { recursive: true });
cpSync(path.join(ROOT, 'node_modules/three/build/three.min.js'), path.join(OUT, 'vendor/three.min.js'));
console.log(`Built ${path.relative(ROOT, OUT)}`);
