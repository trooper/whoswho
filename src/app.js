// The guest board's HTTP API, live updates and pages, as one fetch-style
// handler: (Request) -> Response, or null when nothing here matches (then the
// caller serves a static file). Node (server.js) and the Cloudflare Worker
// (worker/index.js) both run it, so there is one copy of every route.

import QRCode from 'qrcode/lib/core/qrcode.js';
import SvgTag from 'qrcode/lib/renderer/svg-tag.js';
import { publicGuest, ValidationError, AuthError } from './db.js';
import { checkAdmin } from './auth.js';
import { parsePostcode, lookupOutcode } from './postcode.js';

const BODY_LIMIT = 32 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

async function readJson(request) {
  const len = Number(request.headers.get('content-length'));
  if (len > BODY_LIMIT) throw new HttpError(413, 'Request too large');
  const text = await request.text();
  if (text.length > BODY_LIMIT) throw new HttpError(413, 'Request too large');
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

/**
 * @param {object} o
 * @param {ReturnType<import('./db.js').createStore>} o.db
 * @param {string} [o.adminPassword] admin routes are open when empty
 * @param {(req: Request) => string} o.baseUrl where other devices should go
 * @param {(req: Request) => object} [o.info] extra fields for /api/info
 * @param {(name: 'home'|'hi'|'hax0r') => Promise<string>} o.page page HTML
 */
export function createHandler({ db, adminPassword, baseUrl, info = () => ({}), page }) {
  const urls = (req) => {
    const base = baseUrl(req);
    return { base, hiUrl: `${base}/hi`, homeUrl: `${base}/home`, adminUrl: `${base}/hax0r` };
  };

  // ------------------------------------------------------------- live (SSE)
  // Every event gets a sequence number and is kept briefly, so a page behind
  // a proxy that buffers SSE can poll /api/poll instead and still see every
  // event, in order.
  const enc = new TextEncoder();
  const clients = new Set();
  const recent = [];
  let seq = 0;
  const send = (c, msg) => c.writer.write(enc.encode(msg)).catch(() => clients.delete(c));
  const broadcast = (event, data) => {
    seq++;
    recent.push({ seq, event, data });
    if (recent.length > 500) recent.shift();
    const msg = `id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) send(c, msg);
  };
  // A real event (not a comment), so pages can tell the stream is alive.
  const heartbeat = setInterval(() => {
    for (const c of clients) send(c, `event: ping\ndata: ${seq}\n\n`);
  }, 15_000);
  heartbeat.unref?.();

  function events(req) {
    const { readable, writable } = new TransformStream();
    const c = { writer: writable.getWriter() };
    clients.add(c);
    send(c, `retry: 3000\nevent: hello\ndata: ${seq}\n\n`);
    req.signal?.addEventListener('abort', () => {
      clients.delete(c);
      c.writer.close().catch(() => {});
    });
    return new Response(readable, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'x-accel-buffering': 'no',
      },
    });
  }

  function poll(url) {
    const since = Number(url.searchParams.get('since'));
    const oldest = recent.length ? recent[0].seq : seq + 1;
    const known = Number.isInteger(since) && since >= 0 && since <= seq;
    return json({
      seq,
      reset: !known || since < oldest - 1,
      events: known ? recent.filter((e) => e.seq > since) : [],
    }, 200, { 'cache-control': 'no-store' });
  }

  // ----------------------------------------------------------------- routes
  const tokenOf = (req) => req.headers.get('x-guest-token') || '';
  const parseId = (s) => {
    const id = Number(s);
    return Number.isInteger(id) && id > 0 ? id : null;
  };
  const html = (text) => new Response(text, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  const notFound = (what) => json({ error: `${what} not found` }, 404);

  // [method, path (with :id), admin?, handler(req, params, url)]
  const routes = [
    ['GET', '/', false, () => new Response(null, { status: 302, headers: { location: '/home' } })],
    // Link previews (og:image) need absolute URLs: fill in this server's address.
    ['GET', '/home', false, async (req) => html((await page('home')).replaceAll('{{BASE}}', urls(req).base))],
    ['GET', '/hi', false, async (req) => html((await page('hi')).replaceAll('{{BASE}}', urls(req).base))],
    ['GET', '/hax0r', true, async () => html(await page('hax0r'))],

    ['GET', '/api/events', false, (req) => events(req)],
    ['GET', '/api/poll', false, (_req, _p, url) => poll(url)],

    // ----------------------------------------------------------- public API
    ['GET', '/api/guests', false, () => json(db.listGuests().map(publicGuest))],
    ['POST', '/api/guests', false, async (req) => {
      const { guest, token } = db.createGuest(await readJson(req));
      broadcast('guests', { type: 'created', guest: publicGuest(guest) });
      return json({ guest: publicGuest(guest), token }, 201);
    }],

    // The phone's own identity: a token handed out once, on join.
    ['GET', '/api/me', false, (req) => {
      const me = db.guestByToken(tokenOf(req));
      return me ? json(publicGuest(me)) : json({ error: 'Unknown phone, join first' }, 401);
    }],
    // Older phones: {need} sends one more lantern.
    ['PUT', '/api/me', false, async (req) => {
      const { guest, wish } = db.addWish(tokenOf(req), (await readJson(req))?.need);
      broadcast('wishes', { type: 'created', wish });
      return json(publicGuest(guest));
    }],

    // Wishes: one lantern each, as many as you like. Names show on lanterns.
    ['GET', '/api/wishes', false, () => json(db.listWishes())],
    ['POST', '/api/wishes', false, async (req) => {
      const { guest, wish } = db.addWish(tokenOf(req), (await readJson(req))?.text);
      broadcast('wishes', { type: 'created', wish });
      return json({ wish, me: publicGuest(guest) }, 201);
    }],

    // Fun things: the author is stored (so moderation can trace abuse from
    // /hax0r) but never sent to the display or the public API.
    ['GET', '/api/secrets', false, () => json(db.listSecrets())],
    ['POST', '/api/secrets', false, async (req) => {
      const secret = db.createSecret(tokenOf(req), await readJson(req));
      broadcast('secrets', { type: 'created', secret });
      return json(secret, 201);
    }],

    ['GET', '/api/settings', false, () => json(db.getSettings())],

    ['GET', '/api/postcode/:id', false, (_req, p) => {
      const parsed = parsePostcode(decodeURIComponent(p.id));
      if (!parsed) return json({ valid: false, known: false });
      const hit = lookupOutcode(parsed.outcode);
      return json({ valid: true, known: !!hit, outcode: parsed.outcode, area: hit?.area ?? null });
    }],

    ['GET', '/api/info', false, (req) => json({ ...urls(req), ...info(req) })],

    ['GET', '/api/qr.svg', false, (req) => {
      const opts = { margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } };
      const svg = SvgTag.render(QRCode.create(urls(req).hiUrl, opts), opts);
      return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' } });
    }],

    // ------------------------------------------------------------ admin API
    ['GET', '/api/admin/guests', true, () => json(db.listGuests())],
    ['PUT', '/api/admin/guests/:id', true, async (req, p) => {
      const id = parseId(p.id);
      const guest = id && db.updateGuest(id, await readJson(req));
      if (!guest) return notFound('Guest');
      broadcast('guests', { type: 'updated', guest: publicGuest(guest) });
      return json(guest);
    }],
    ['DELETE', '/api/admin/guests/:id', true, (_req, p) => {
      const id = parseId(p.id);
      if (!id || !db.deleteGuest(id)) return notFound('Guest');
      broadcast('guests', { type: 'deleted', id });
      broadcast('secrets', { type: 'reset' }); // secrets about them went too
      broadcast('wishes', { type: 'reset' });
      return new Response(null, { status: 204 });
    }],
    ['DELETE', '/api/admin/guests', true, async (req) => {
      if ((await readJson(req))?.confirm !== 'DELETE') {
        return json({ error: 'Send {"confirm":"DELETE"} to remove every guest' }, 400);
      }
      const deleted = db.deleteAllGuests();
      for (const e of ['guests', 'secrets', 'wishes']) broadcast(e, { type: 'reset' });
      return json({ deleted });
    }],
    ['GET', '/api/admin/secrets', true, () => json(db.listSecretsAdmin())],
    ['DELETE', '/api/admin/secrets/:id', true, (_req, p) => {
      const id = parseId(p.id);
      if (!id || !db.deleteSecret(id)) return notFound('Secret');
      broadcast('secrets', { type: 'deleted', id });
      return new Response(null, { status: 204 });
    }],
    ['DELETE', '/api/admin/wishes/:id', true, (_req, p) => {
      const id = parseId(p.id);
      const guest = id && db.deleteWish(id);
      if (!guest) return notFound('Wish');
      broadcast('wishes', { type: 'deleted', id });
      return new Response(null, { status: 204 });
    }],
    ['PUT', '/api/settings', true, async (req) => {
      const settings = db.updateSettings(await readJson(req));
      broadcast('settings', settings);
      return json(settings);
    }],

    // Move the whole party between servers (e.g. a laptop and Cloudflare).
    ['GET', '/api/admin/backup', true, () =>
      json(db.exportAll(), 200, { 'content-disposition': 'attachment; filename="whoswho-backup.json"', 'cache-control': 'no-store' })],
    ['PUT', '/api/admin/backup', true, async (req) => {
      const counts = db.importAll(await readJsonLarge(req));
      for (const e of ['guests', 'secrets', 'wishes']) broadcast(e, { type: 'reset' });
      broadcast('settings', db.getSettings());
      return json(counts);
    }],
  ].map(([method, path, admin, fn]) => ({
    method,
    admin,
    fn,
    re: new RegExp(`^${path.replace(/:id/g, '([^/]+)')}$`),
  }));

  // A backup can be bigger than a normal request.
  async function readJsonLarge(req) {
    try {
      return JSON.parse(await req.text());
    } catch {
      throw new HttpError(400, 'Invalid JSON');
    }
  }

  const unauthorized = () =>
    json({ error: 'Admin password required' }, 401, { 'www-authenticate': 'Basic realm="whoswho admin", charset="UTF-8"' });

  async function handle(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    let pathMatched = false;
    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== req.method && !(r.method === 'GET' && req.method === 'HEAD')) continue;
      try {
        if (r.admin && !(await checkAdmin(req.headers.get('authorization'), adminPassword))) return unauthorized();
        return await r.fn(req, { id: m[1] }, url);
      } catch (err) {
        if (err instanceof ValidationError) return json({ error: err.message, field: err.field }, 400);
        if (err instanceof AuthError) return json({ error: err.message }, 401);
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        console.error(err);
        return json({ error: 'Something went wrong' }, 500);
      }
    }
    if (path.startsWith('/api/')) return json({ error: pathMatched ? 'Method not allowed' : 'Not found' }, pathMatched ? 405 : 404);
    return null;
  }

  return {
    handle,
    broadcast,
    close() {
      clearInterval(heartbeat);
      for (const c of clients) c.writer.close().catch(() => {});
      clients.clear();
    },
  };
}
