// whoswho on Cloudflare: static files come from Workers Static Assets (built
// into dist/public by scripts/build-worker.mjs); everything else (pages, API,
// live updates) goes to one Durable Object, the party, which keeps the data in
// its own SQLite storage and holds every screen's live connection.

import { DurableObject } from 'cloudflare:workers';
import { createStore } from '../src/db.js';
import { createHandler } from '../src/app.js';
import { durableDriver } from './sqlite-driver.js';
import home from '../pages/home.html';
import hi from '../pages/hi.html';
import hax0r from '../pages/hax0r.html';

const PAGES = { home, hi, hax0r };

export class Party extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.handler = createHandler({
      db: createStore(durableDriver(ctx.storage)),
      // On the open internet the admin stays locked until the secret is set.
      adminPassword: env.ADMIN_PASSWORD || crypto.randomUUID(),
      baseUrl: (req) => env.PUBLIC_URL?.replace(/\/+$/, '') || new URL(req.url).origin,
      info: (req) => ({ host: new URL(req.url).host, port: null }),
      page: async (name) => PAGES[name],
    });
  }

  async fetch(request) {
    return (await this.handler.handle(request)) ?? new Response('Not found', { status: 404 });
  }
}

export default {
  fetch(request, env) {
    return env.PARTY.get(env.PARTY.idFromName('party')).fetch(request);
  },
};
