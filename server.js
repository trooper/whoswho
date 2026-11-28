// whoswho — local-network guest board.
//   /home   rotating display (3D map · the cloud · wishes) with a QR code to /hi
//   /hi     join, then drop secrets and wishes from your phone
//   /hax0r  admin

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDb } from './src/node-db.js';
import { createHandler } from './src/app.js';
import { lanHost } from './src/network.js';
import { loadEnvFile } from './src/env.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Node: static files from public/, everything else through the same handler
 * the Cloudflare Worker runs (src/app.js).
 * @param {{db: ReturnType<typeof openDb>, getPort: () => number, adminPassword?: string}} opts
 */
export function createApp({ db, getPort, adminPassword = process.env.ADMIN_PASSWORD }) {
  // Where other devices should go. PUBLIC_URL wins; otherwise, a request that
  // came through a tunnel or proxy (Cloudflare, ngrok…) uses that public
  // address, so the QR works from outside the network; else the LAN address.
  const baseUrl = (req) => {
    const fixed = process.env.PUBLIC_URL?.replace(/\/+$/, '');
    if (fixed) return fixed;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
    if (host && /^https?$/.test(proto || '') && !/^(localhost|\[|\d+\.\d+\.\d+\.\d+)/.test(host)) return `${proto}://${host}`;
    return `http://${lanHost()}:${getPort()}`;
  };
  const handler = createHandler({
    db,
    adminPassword,
    baseUrl,
    info: () => ({ host: lanHost(), port: getPort() }),
    page: (name) => fs.readFile(path.join(ROOT, 'pages', `${name}.html`), 'utf8'),
  });

  const app = express();
  app.disable('x-powered-by');
  app.locals.closeClients = () => handler.close();
  app.use(express.static(path.join(ROOT, 'public'), { index: false }));
  app.get('/vendor/three.min.js', (_req, res) => res.sendFile(path.join(ROOT, 'node_modules/three/build/three.min.js')));

  // Node request -> fetch Request -> handler -> stream the Response back.
  app.use(async (req, res, next) => {
    try {
      const ctrl = new AbortController();
      res.on('close', () => ctrl.abort());
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const request = new Request(`http://${req.headers.host || 'localhost'}${req.originalUrl}`, {
        method: req.method,
        headers,
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: 'half',
        signal: ctrl.signal,
      });
      const r = await handler.handle(request);
      if (!r) return next();
      res.status(r.status);
      r.headers.forEach((v, k) => res.setHeader(k, v));
      if (!r.body) return res.end();
      res.flushHeaders();
      const body = Readable.fromWeb(r.body);
      res.on('close', () => body.destroy());
      body.on('error', () => res.end());
      body.pipe(res);
    } catch (err) {
      next(err);
    }
  });
  return app;
}

// ------------------------------------------------------------------- main
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnvFile(); // ./.env, before anything reads process.env
  const PORT = Number(process.env.PORT) || 3000;
  const db = openDb();
  const app = createApp({ db, getPort: () => PORT });
  const server = app.listen(PORT, '0.0.0.0', () => {
    const host = lanHost();
    const b = `http://${host}:${PORT}`;
    console.log(`\n  whoswho is up — open these from any device on your network:\n`);
    console.log(`    Display   ${b}/home`);
    console.log(`    Register  ${b}/hi`);
    console.log(`    Admin     ${b}/hax0r${process.env.ADMIN_PASSWORD ? '  (password protected)' : ''}\n`);
    if (host === 'localhost') console.log('  ⚠ No LAN address found — set PUBLIC_HOST if other devices cannot connect.\n');
  });
  const shutdown = () => {
    app.locals.closeClients();
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
