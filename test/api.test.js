import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/node-db.js';
import { createApp } from '../server.js';

async function start(opts = {}) {
  const db = openDb(':memory:');
  let port = 0;
  const app = createApp({ db, getPort: () => port, ...opts });
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, json, text, headers: res.headers };
  };
  const stop = () => new Promise((r) => { app.locals.closeClients(); server.close(() => { db.close(); r(); }); });
  return { db, base, call, stop };
}

describe('API (open admin)', () => {
  let s;
  before(async () => { s = await start({ adminPassword: '' }); });
  after(() => s.stop());

  test('pages are served and / redirects to /home', async () => {
    for (const p of ['/home', '/hi', '/hax0r']) assert.equal((await s.call('GET', p)).status, 200, p);
    const res = await fetch(s.base + '/', { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/home');
    assert.equal((await s.call('GET', '/vendor/three.min.js')).status, 200);
    const geo = await s.call('GET', '/data/london-3d.json');
    assert.equal(geo.status, 200);
    assert.equal(geo.json.boroughs.length, 33);
    for (const f of ['ww-map.js', 'ww-zoo.js', 'ww-zoo3d.js', 'ww-cloud.js']) assert.equal((await s.call('GET', `/js/3d/${f}`)).status, 200, f);
  });

  test('link previews show the 3D zoo, with this server\'s address', async () => {
    const hi = await s.call('GET', '/hi', undefined, { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'party.trycloudflare.com' });
    assert.match(hi.text, /<meta property="og:image" content="https:\/\/party\.trycloudflare\.com\/img\/og-zoo\.jpg">/);
    assert.ok(!hi.text.includes('{{'), 'no placeholders left');
    const home = await s.call('GET', '/home');
    assert.match(home.text, /og:image" content="http:\/\/[^"]+\/img\/og-zoo\.jpg"/);
    const img = await s.call('GET', '/img/og-zoo.jpg');
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/jpeg');
  });

  test('join: a guest gets a token; public list shows the district, not the postcode', async () => {
    const r = await s.call('POST', '/api/guests', {
      name: '  Robin  ', avatar: { animal: 'koala', color: 'mint', hat: 'evil' }, need: 'a climbing buddy', postcode: 'e8 3pb',
    });
    assert.equal(r.status, 201);
    assert.match(r.json.token, /^[\w-]{20,}$/);
    const g = r.json.guest;
    assert.equal(g.name, 'Robin');
    assert.deepEqual(g.avatar, { animal: 'koala', color: 'mint' });
    assert.equal(g.area, 'Hackney');
    assert.equal(g.outcode, 'E8');
    assert.ok(!('postcode' in g) && !('token' in g));

    const list = await s.call('GET', '/api/guests');
    assert.ok(!('postcode' in list.json[0]) && !('token' in list.json[0]));
    assert.equal((await s.call('GET', '/api/admin/guests')).json[0].postcode, 'E8 3PB');

    const me = await s.call('GET', '/api/me', undefined, { 'x-guest-token': r.json.token });
    assert.equal(me.json.id, g.id);
    assert.equal((await s.call('GET', '/api/me', undefined, { 'x-guest-token': 'nope' })).status, 401);
    assert.equal((await s.call('GET', '/api/me')).status, 401);
  });

  test('secrets: anonymous, self or friend, need a token', async () => {
    const a = (await s.call('POST', '/api/guests', { name: 'Ana', postcode: 'N7' })).json;
    const b = (await s.call('POST', '/api/guests', { name: 'Ben', postcode: 'SE10' })).json;
    const asA = { 'x-guest-token': a.token };

    const self = await s.call('POST', '/api/secrets', { text: 'plays piano by ear', about: 'me' }, asA);
    assert.equal(self.status, 201);
    assert.deepEqual(
      { by: self.json.by, vibe: self.json.vibe, aboutId: self.json.aboutId },
      { by: 'self', vibe: 'creative', aboutId: a.guest.id },
    );
    const friend = await s.call('POST', '/api/secrets', { text: 'keeps bees on a rooftop', about: b.guest.id }, asA);
    assert.equal(friend.json.by, 'friend');
    assert.equal(friend.json.aboutId, b.guest.id);
    // writing about yourself by id still counts as "self"
    assert.equal((await s.call('POST', '/api/secrets', { text: 'ran a marathon', about: a.guest.id }, asA)).json.by, 'self');

    assert.equal((await s.call('POST', '/api/secrets', { text: 'no token', about: 'me' })).status, 401);
    assert.equal((await s.call('POST', '/api/secrets', { text: 'x', about: 'me' }, asA)).status, 400);
    assert.equal((await s.call('POST', '/api/secrets', { text: 'about nobody', about: 99999 }, asA)).status, 400);

    const pub = (await s.call('GET', '/api/secrets')).json;
    assert.equal(pub.length, 3);
    for (const x of pub) assert.deepEqual(Object.keys(x).sort(), ['aboutId', 'by', 'createdAt', 'id', 'text', 'vibe']);
    const admin = (await s.call('GET', '/api/admin/secrets')).json;
    assert.equal(admin[1].authorName, 'Ana');
    assert.equal(admin[1].aboutName, 'Ben');

    assert.equal((await s.call('DELETE', `/api/admin/secrets/${friend.json.id}`)).status, 204);
    assert.equal((await s.call('DELETE', `/api/admin/secrets/${friend.json.id}`)).status, 404);
    // deleting a guest removes the secrets about them
    await s.call('POST', '/api/secrets', { text: 'about Ben again', about: b.guest.id }, asA);
    await s.call('DELETE', `/api/admin/guests/${b.guest.id}`);
    assert.ok(!(await s.call('GET', '/api/secrets')).json.some((x) => x.aboutId === b.guest.id));
  });

  test('wishes: a phone sets its own wish', async () => {
    const { token, guest } = (await s.call('POST', '/api/guests', { name: 'Wisher' })).json;
    const r = await s.call('PUT', '/api/me', { need: '  a  tennis partner ' }, { 'x-guest-token': token });
    assert.equal(r.status, 200);
    assert.equal(r.json.need, 'a tennis partner');
    assert.equal((await s.call('GET', '/api/guests')).json.find((g) => g.id === guest.id).need, 'a tennis partner');
    assert.equal((await s.call('PUT', '/api/me', { need: 'x' }, { 'x-guest-token': token })).status, 400);
    assert.equal((await s.call('PUT', '/api/me', { need: 'no token here' })).status, 401);
  });

  test('validation errors are 400s', async () => {
    assert.equal((await s.call('POST', '/api/guests', { name: '   ' })).status, 400);
    assert.equal((await s.call('POST', '/api/guests', {})).status, 400);
    const bad = await fetch(s.base + '/api/guests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    assert.equal(bad.status, 400);
    assert.equal((await s.call('PUT', '/api/settings', { rotateSeconds: 1 })).status, 400);
    assert.equal((await s.call('PUT', '/api/settings', { views: [] })).status, 400);
  });

  test('edit, delete, reset', async () => {
    const { json: { guest: g, token } } = await s.call('POST', '/api/guests', { name: 'Sam', postcode: 'SW11' });
    await s.call('POST', '/api/secrets', { text: 'secret', about: 'me' }, { 'x-guest-token': token });
    const upd = await s.call('PUT', `/api/admin/guests/${g.id}`, { name: 'Sam B', postcode: 'N1', avatar: { animal: 'cow', color: 'pink' } });
    assert.equal(upd.status, 200);
    assert.equal(upd.json.name, 'Sam B');
    assert.deepEqual(upd.json.avatar, { animal: 'cow', color: 'pink' });
    assert.equal(upd.json.area, 'Islington');
    assert.ok(upd.json.updatedAt);
    assert.equal((await s.call('PUT', '/api/admin/guests/9999', { name: 'x' })).status, 404);
    assert.equal((await s.call('DELETE', `/api/admin/guests/${g.id}`)).status, 204);
    assert.equal((await s.call('DELETE', `/api/admin/guests/${g.id}`)).status, 404);
    assert.equal((await s.call('DELETE', '/api/admin/guests', {})).status, 400);
    const reset = await s.call('DELETE', '/api/admin/guests', { confirm: 'DELETE' });
    assert.equal(reset.status, 200);
    assert.equal((await s.call('GET', '/api/guests')).json.length, 0);
    assert.equal((await s.call('GET', '/api/secrets')).json.length, 0);
  });

  test('settings round-trip', async () => {
    const def = await s.call('GET', '/api/settings');
    assert.equal(def.json.rotateSeconds, 40);
    assert.deepEqual(def.json.views, ['map', 'cloud', 'wishes']);
    const r = await s.call('PUT', '/api/settings', { rotateSeconds: 7, views: ['wishes', 'map', 'bogus'], title: 'Party' });
    assert.deepEqual(r.json, { title: 'Party', rotateSeconds: 7, views: ['map', 'wishes'] });
    assert.deepEqual((await s.call('GET', '/api/settings')).json, r.json);
  });

  test('postcode check, info and QR', async () => {

    assert.deepEqual((await s.call('GET', '/api/postcode/se15%204qf')).json, { valid: true, known: true, outcode: 'SE15', area: 'Southwark' });
    assert.equal((await s.call('GET', '/api/postcode/zzz')).json.valid, false);

    const info = (await s.call('GET', '/api/info')).json;
    assert.match(info.hiUrl, /^http:\/\/[^/]+:\d+\/hi$/);
    // Reached through a tunnel (Cloudflare sets these): the QR uses the public address.
    const tunnelled = (await s.call('GET', '/api/info', undefined, { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'party.trycloudflare.com' })).json;
    assert.equal(tunnelled.hiUrl, 'https://party.trycloudflare.com/hi');
    // A spoofed LAN-ish host without a proxy proto header is ignored.
    assert.match((await s.call('GET', '/api/info', undefined, { host: 'evil.example' })).json.hiUrl, /^http:\/\/[^/]+:\d+\/hi$/);
    const qr = await s.call('GET', '/api/qr.svg');
    assert.equal(qr.status, 200);
    assert.match(qr.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(qr.text, /<svg/);
    assert.equal((await s.call('GET', '/api/nope')).status, 404);
  });

  test('polling fallback returns events in order, and asks for a reset when behind', async () => {
    const start = (await s.call('GET', '/api/poll?since=-1')).json;
    assert.equal(start.reset, true);
    await s.call('POST', '/api/guests', { name: 'Poller' });
    const r = (await s.call('GET', `/api/poll?since=${start.seq}`)).json;
    assert.equal(r.reset, false);
    assert.deepEqual(r.events.map((e) => [e.seq, e.event, e.data.type]), [[start.seq + 1, 'guests', 'created']]);
    assert.equal(r.events[0].data.guest.name, 'Poller');
    assert.equal((await s.call('GET', `/api/poll?since=${r.seq}`)).json.events.length, 0);
    assert.equal((await s.call('GET', `/api/poll?since=${r.seq + 100}`)).json.reset, true, 'server restarted');
  });

  test('SSE stream announces new guests and secrets, without the author', async () => {
    const ctrl = new AbortController();
    const res = await fetch(s.base + '/api/events', { signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const { json: { token } } = await s.call('POST', '/api/guests', { name: 'Live' });
    await s.call('POST', '/api/secrets', { text: 'got stuck in a lift with a pop star', about: 'me' }, { 'x-guest-token': token });
    while (!buf.includes('event: secrets')) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
    }
    ctrl.abort();
    assert.match(buf, /event: hello\ndata: \d+/);
    assert.match(buf, /id: \d+\nevent: guests\ndata: .*"name":"Live"/);
    assert.match(buf, /event: secrets\ndata: .*"vibe":"happy"/);
    assert.ok(!/author|token/.test(buf.split('event: secrets')[1]));
  });
});

describe('API (password-protected admin)', () => {
  let s;
  before(async () => { s = await start({ adminPassword: 's3cret' }); });
  after(() => s.stop());

  test('admin routes need Basic auth; public routes do not', async () => {
    const auth = { authorization: 'Basic ' + Buffer.from('admin:s3cret').toString('base64') };
    const wrong = { authorization: 'Basic ' + Buffer.from('admin:nope').toString('base64') };
    assert.equal((await s.call('GET', '/hax0r')).status, 401);
    assert.equal((await s.call('GET', '/api/admin/guests')).status, 401);
    assert.equal((await s.call('GET', '/api/admin/guests', undefined, wrong)).status, 401);
    assert.equal((await s.call('PUT', '/api/settings', { title: 'x' })).status, 401);
    assert.equal((await s.call('GET', '/api/admin/secrets')).status, 401);
    assert.equal((await s.call('DELETE', '/api/admin/secrets/1')).status, 401);
    assert.equal((await s.call('GET', '/api/secrets')).status, 200);
    assert.equal((await s.call('GET', '/hax0r', undefined, auth)).status, 200);
    assert.equal((await s.call('GET', '/api/admin/guests', undefined, auth)).status, 200);
    assert.equal((await s.call('POST', '/api/guests', { name: 'Pub' })).status, 201);
    assert.equal((await s.call('GET', '/api/settings')).status, 200);
    assert.equal((await s.call('GET', '/api/admin/backup')).status, 401);
    assert.equal((await s.call('PUT', '/api/admin/backup', {})).status, 401);
  });
});

test('backup and restore move the whole party, phones included', async () => {
  const a = await start({ adminPassword: '' });
  const b = await start({ adminPassword: '' });
  try {
    const j = await a.call('POST', '/api/guests', { name: 'Mover', postcode: 'E8 1AA', avatar: { animal: 'fox', color: 'pink' } });
    const tok = { 'x-guest-token': j.json.token };
    await a.call('POST', '/api/secrets', { text: 'juggles oranges', about: 'me' }, tok);
    await a.call('POST', '/api/wishes', { text: 'a canoe' }, tok);
    await a.call('PUT', '/api/settings', { title: 'Moved party' });
    const backup = (await a.call('GET', '/api/admin/backup')).json;
    assert.equal(backup.format, 'whoswho-backup');
    await b.call('POST', '/api/guests', { name: 'Overwritten' });
    const r = await b.call('PUT', '/api/admin/backup', backup);
    assert.deepEqual(r.json, { guests: 1, secrets: 1, wishes: 1, settings: 1 });
    assert.deepEqual((await b.call('GET', '/api/guests')).json, (await a.call('GET', '/api/guests')).json);
    assert.equal((await b.call('GET', '/api/secrets')).json[0].text, 'juggles oranges');
    assert.equal((await b.call('GET', '/api/settings')).json.title, 'Moved party');
    // the phone's token still works on the new server, and new rows don't clash
    assert.equal((await b.call('GET', '/api/me', undefined, tok)).json.name, 'Mover');
    assert.equal((await b.call('POST', '/api/wishes', { text: 'a paddle' }, tok)).status, 201);
    assert.equal((await b.call('GET', '/api/wishes')).json.length, 2);
    assert.equal((await b.call('PUT', '/api/admin/backup', { nope: 1 })).status, 400);
  } finally {
    await a.stop();
    await b.stop();
  }
});

test('data survives reopening the database file', async (t) => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'whoswho-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'test.sqlite');
  let db = openDb(file);
  const { guest } = db.createGuest({ name: 'Persist', postcode: 'E8' });
  db.addSecret({ text: 'was here', aboutId: guest.id, by: 'self' });
  db.updateSettings({ rotateSeconds: 9 });
  db.close();
  db = openDb(file);
  assert.equal(db.listGuests()[0].name, 'Persist');
  assert.equal(db.listSecrets()[0].text, 'was here');
  assert.equal(db.getSettings().rotateSeconds, 9);
  db.close();
});

test('a v2 database (old avatars, old views) migrates cleanly', async (t) => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { DatabaseSync } = await import('node:sqlite');
  const dir = mkdtempSync(join(tmpdir(), 'whoswho-v2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'old.sqlite');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE guests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, avatar TEXT NOT NULL,
      vibes TEXT NOT NULL DEFAULT '[]', need TEXT, postcode TEXT, area TEXT, lat REAL, lng REAL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), updated_at TEXT);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    ALTER TABLE guests ADD COLUMN about TEXT;
    PRAGMA user_version = 2;`);
  old.prepare('INSERT INTO guests (name, avatar, vibes, need) VALUES (?, ?, ?, ?)').run('Old', JSON.stringify({ animal: 'sloth', glasses: 'round', bg: 'peach' }), '["art"]', 'a nap');
  old.prepare('INSERT INTO settings VALUES (?, ?)').run('views', JSON.stringify(['graph', 'needs']));
  old.close();

  const db = openDb(file);
  t.after(() => db.close());
  const [g] = db.listGuests();
  assert.deepEqual(g.avatar, { animal: 'sloth', color: 'orange' }); // sloth is a zoo animal now
  assert.equal(g.need, 'a nap');
  assert.deepEqual(db.getSettings().views, ['map', 'cloud', 'wishes']);
  assert.equal(db.addSecret({ text: 'migrated', aboutId: g.id }).by, 'friend');
  assert.deepEqual(db.listWishes().map((w) => [w.guestId, w.text]), [[g.id, 'a nap']], 'old wishes become lanterns');
});

test('wishes: as many lanterns as you like, moderated one by one', async (t) => {
  const s = await start({ adminPassword: '' });
  t.after(() => s.stop());
  const { token, guest } = (await s.call('POST', '/api/guests', { name: 'Hana', need: 'a Spanish teacher' })).json;
  const auth = { 'x-guest-token': token };
  const a = await s.call('POST', '/api/wishes', { text: '  more honey jars ' }, auth);
  assert.equal(a.status, 201);
  assert.equal(a.json.wish.text, 'more honey jars');
  assert.equal(a.json.me.need, 'more honey jars', 'need is the latest wish');
  await s.call('PUT', '/api/me', { need: 'a quiet Sunday' }, auth); // older phones
  let list = (await s.call('GET', '/api/wishes')).json;
  assert.deepEqual(list.map((w) => w.text), ['a Spanish teacher', 'more honey jars', 'a quiet Sunday']);
  assert.ok(list.every((w) => w.guestId === guest.id));
  assert.equal((await s.call('POST', '/api/wishes', { text: 'x' }, auth)).status, 400);
  assert.equal((await s.call('POST', '/api/wishes', { text: 'no token' })).status, 401);

  assert.equal((await s.call('DELETE', `/api/admin/wishes/${list[2].id}`)).status, 204);
  assert.equal((await s.call('DELETE', `/api/admin/wishes/${list[2].id}`)).status, 404);
  const me = (await s.call('GET', '/api/me', undefined, auth)).json;
  assert.equal(me.need, 'more honey jars', 'deleting the latest falls back to the one before');

  // admin edits don't touch wishes; deleting the guest takes their lanterns
  await s.call('PUT', `/api/admin/guests/${guest.id}`, { name: 'Hana B' });
  assert.equal((await s.call('GET', '/api/wishes')).json.length, 2);
  await s.call('DELETE', `/api/admin/guests/${guest.id}`);
  assert.equal((await s.call('GET', '/api/wishes')).json.length, 0);
});
