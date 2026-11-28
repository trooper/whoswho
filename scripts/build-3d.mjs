#!/usr/bin/env node
// Builds public/data/london-3d.json for the 3D views from the bundled borough
// outlines: simplified rings and the Thames, in km around Charing Cross
// (x east, y north). Output is committed; rerun only if the geodata changes.
//
// Usage: npm run build:3d

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { project } from '../public/js/geo.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const round = (n) => Math.round(n * 100) / 100;
const P = (lat, lng) => project(lat, lng).map(round);

// Ramer–Douglas–Peucker, so 33 boroughs stay light enough to extrude.
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let dmax = 0;
  let idx = 0;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / L;
    if (d > dmax) [dmax, idx] = [d, i];
  }
  if (dmax > eps) return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
  return [a, b];
}

const gj = JSON.parse(readFileSync(path.join(ROOT, 'data/london-boroughs.geojson'), 'utf8'));
const boroughs = gj.features.map((f) => {
  const g = f.geometry;
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  const rings = [];
  for (const poly of polys) {
    const r = poly[0].map(([lng, lat]) => P(lat, lng));
    const h = Math.floor(r.length / 2);
    const simple = [...rdp(r.slice(0, h + 1), 0.08).slice(0, -1), ...rdp(r.slice(h), 0.08)];
    if (simple.length >= 4) rings.push(simple);
  }
  return { n: f.properties.name, r: rings };
});

// Hand-traced centre line of the river, Kingston to Erith (lat, lng).
const THAMES = [[51.403, -0.337], [51.41, -0.309], [51.431, -0.322], [51.445, -0.322], [51.458, -0.307], [51.471, -0.296], [51.483, -0.288], [51.487, -0.268], [51.488, -0.245], [51.488, -0.23], [51.477, -0.222], [51.468, -0.213], [51.463, -0.195], [51.472, -0.18], [51.481, -0.17], [51.485, -0.15], [51.487, -0.128], [51.495, -0.123], [51.501, -0.121], [51.507, -0.117], [51.509, -0.104], [51.507, -0.088], [51.505, -0.075], [51.504, -0.058], [51.506, -0.04], [51.505, -0.03], [51.496, -0.025], [51.486, -0.014], [51.484, -0.004], [51.49, 0.004], [51.502, 0.006], [51.503, 0.012], [51.494, 0.022], [51.493, 0.045], [51.494, 0.065], [51.503, 0.09], [51.51, 0.11], [51.512, 0.13], [51.503, 0.16], [51.488, 0.18], [51.472, 0.215], [51.465, 0.255]];

mkdirSync(path.join(ROOT, 'public/data'), { recursive: true });
const out = path.join(ROOT, 'public/data/london-3d.json');
writeFileSync(out, JSON.stringify({ boroughs, thames: THAMES.map(([a, b]) => P(a, b)) }));
console.log(`wrote ${path.relative(ROOT, out)}: ${boroughs.length} boroughs, ${boroughs.reduce((n, b) => n + b.r.reduce((m, r) => m + r.length, 0), 0)} points`);
