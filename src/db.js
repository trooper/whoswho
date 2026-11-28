// SQLite persistence, synchronous. The same queries run on Node's node:sqlite
// (openDb: one file, survives restarts) and on a Cloudflare Durable Object's
// SQLite storage (createStore with worker/sqlite-driver.js).
import { normalizeAvatar } from '../public/js/animals.js';
import { classify } from '../public/js/weather.js';
import { resolveLocation } from './postcode.js';

export const LIMITS = { name: 40, need: 140, secret: 140 };
export const VIEW_IDS = ['map', 'cloud', 'wishes'];

export const DEFAULT_SETTINGS = Object.freeze({
  title: "Who's here?",
  rotateSeconds: 40,
  views: VIEW_IDS,
});

const MIGRATIONS = [
  `CREATE TABLE guests (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     avatar TEXT NOT NULL,
     vibes TEXT NOT NULL DEFAULT '[]',
     need TEXT,
     postcode TEXT,
     area TEXT,
     lat REAL,
     lng REAL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     updated_at TEXT
   );
   CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  // v2: free-form "about you" text (no longer used since v3)
  `ALTER TABLE guests ADD COLUMN about TEXT;`,
  // v3: phones get a token; secrets about guests feed the Cloud and the Map
  `ALTER TABLE guests ADD COLUMN token TEXT;
   CREATE UNIQUE INDEX guests_token ON guests(token);
   CREATE TABLE secrets (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     text TEXT NOT NULL,
     about_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
     author_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
     by TEXT NOT NULL CHECK (by IN ('self', 'friend')),
     vibe TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );
   CREATE INDEX secrets_about ON secrets(about_id);`,
  // v4: "life as an animal" and its AI story (both no longer used)
  `ALTER TABLE guests ADD COLUMN life TEXT;
   ALTER TABLE guests ADD COLUMN story TEXT;`,
  // v5: as many wishes (lanterns) as you like; guests.need keeps the latest
  `CREATE TABLE wishes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
     text TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );
   CREATE INDEX wishes_guest ON wishes(guest_id);
   INSERT INTO wishes (guest_id, text, created_at)
     SELECT id, need, COALESCE(updated_at, created_at) FROM guests WHERE need IS NOT NULL AND need != '';`,
];

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

export class AuthError extends Error {}

const cleanText = (v, max) =>
  typeof v === 'string' ? v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Validate + normalise user input. Throws ValidationError. */
export function cleanGuestInput(input) {
  const src = input && typeof input === 'object' ? input : {};
  const name = cleanText(src.name, LIMITS.name);
  if (!name) throw new ValidationError('Name is required', 'name');
  return {
    name,
    avatar: normalizeAvatar(src.avatar),
    need: cleanText(src.need, LIMITS.need) || null,
    postcodeInput: typeof src.postcode === 'string' ? src.postcode : '',
  };
}

function rowToGuest(r) {
  return {
    id: r.id,
    name: r.name,
    avatar: normalizeAvatar(JSON.parse(r.avatar)), // maps old 2D avatars too
    need: r.need,
    postcode: r.postcode,
    area: r.area,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Public projection: only the district (E8), never the full postcode. */
export function publicGuest(g) {
  const { postcode, ...rest } = g;
  return { ...rest, outcode: g.area && postcode ? postcode.split(' ')[0] : null };
}

const rowToWish = (r) => ({ id: r.id, guestId: r.guest_id, text: r.text, createdAt: r.created_at });

const rowToSecret = (r) => ({ id: r.id, text: r.text, vibe: r.vibe, by: r.by, aboutId: r.about_id, createdAt: r.created_at });

// A phone's identity: 18 random bytes, base64url (24 characters).
const newToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Columns a backup carries, per table (see exportAll / importAll).
const TABLES = {
  guests: ['id', 'name', 'avatar', 'vibes', 'need', 'postcode', 'area', 'lat', 'lng', 'created_at', 'updated_at', 'about', 'token', 'life', 'story'],
  secrets: ['id', 'text', 'about_id', 'author_id', 'by', 'vibe', 'created_at'],
  wishes: ['id', 'guest_id', 'text', 'created_at'],
  settings: ['key', 'value'],
};

/**
 * The guest board's data, over any driver with
 * {exec, prepare(sql) -> {run, get, all}, tx(fn), version(), setVersion(v), close()}.
 * run() returns {lastInsertRowid, changes}.
 */
export function createStore(db) {
  for (let v = db.version(); v < MIGRATIONS.length; v++) {
    db.tx(() => {
      db.exec(MIGRATIONS[v]);
      db.setVersion(v + 1);
    });
  }

  const q = {
    all: db.prepare('SELECT * FROM guests ORDER BY id'),
    get: db.prepare('SELECT * FROM guests WHERE id = ?'),
    byToken: db.prepare('SELECT * FROM guests WHERE token = ?'),
    insert: db.prepare('INSERT INTO guests (name, avatar, need, token) VALUES (?, ?, ?, ?)'),
    update: db.prepare(
      `UPDATE guests SET name = ?, avatar = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ),
    wishesAll: db.prepare('SELECT * FROM wishes ORDER BY id'),
    wishGet: db.prepare('SELECT * FROM wishes WHERE id = ?'),
    wishInsert: db.prepare('INSERT INTO wishes (guest_id, text) VALUES (?, ?)'),
    wishDel: db.prepare('DELETE FROM wishes WHERE id = ?'),
    wishesDelAll: db.prepare('DELETE FROM wishes'),
    latestWish: db.prepare('SELECT text FROM wishes WHERE guest_id = ? ORDER BY id DESC LIMIT 1'),
    setNeed: db.prepare(`UPDATE guests SET need = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`),
    setLoc: db.prepare('UPDATE guests SET postcode = ?, area = ?, lat = ?, lng = ? WHERE id = ?'),
    del: db.prepare('DELETE FROM guests WHERE id = ?'),
    delAll: db.prepare('DELETE FROM guests'),
    secretsAll: db.prepare('SELECT * FROM secrets ORDER BY id'),
    secretsAdmin: db.prepare(
      `SELECT s.*, a.name AS about_name, w.name AS author_name FROM secrets s
         JOIN guests a ON a.id = s.about_id LEFT JOIN guests w ON w.id = s.author_id ORDER BY s.id`,
    ),
    secretGet: db.prepare('SELECT * FROM secrets WHERE id = ?'),
    secretInsert: db.prepare('INSERT INTO secrets (text, about_id, author_id, by, vibe) VALUES (?, ?, ?, ?, ?)'),
    secretDel: db.prepare('DELETE FROM secrets WHERE id = ?'),
    secretsDelAll: db.prepare('DELETE FROM secrets'),
    settingsAll: db.prepare('SELECT key, value FROM settings'),
    settingsPut: db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ),
  };

  const tx = (fn) => db.tx(fn);

  const applyLocation = (id, postcodeInput) => {
    const loc = resolveLocation(postcodeInput, id);
    q.setLoc.run(loc.postcode, loc.area, loc.lat, loc.lng, id);
  };

  const authorFor = (token) => {
    const r = typeof token === 'string' && token ? q.byToken.get(token) : null;
    if (!r) throw new AuthError('Join first, then try again');
    return r;
  };

  return {
    raw: db.raw ?? db,
    close: () => db.close(),

    listGuests: () => q.all.all().map(rowToGuest),

    getGuest: (id) => {
      const r = q.get.get(id);
      return r ? rowToGuest(r) : null;
    },

    guestByToken: (token) => {
      const r = typeof token === 'string' && token ? q.byToken.get(token) : null;
      return r ? rowToGuest(r) : null;
    },

    /** Returns {guest, token}; the token is the phone's identity from then on. */
    createGuest(input) {
      const c = cleanGuestInput(input);
      const token = newToken();
      return tx(() => {
        const { lastInsertRowid } = q.insert.run(c.name, JSON.stringify(c.avatar), c.need, token);
        const id = Number(lastInsertRowid);
        if (c.need) q.wishInsert.run(id, c.need);
        applyLocation(id, c.postcodeInput);
        return { guest: rowToGuest(q.get.get(id)), token };
      });
    },

    updateGuest(id, input) {
      const c = cleanGuestInput(input);
      return tx(() => {
        const existing = q.get.get(id);
        if (!existing) return null;
        q.update.run(c.name, JSON.stringify(c.avatar), id); // wishes are moderated one by one
        applyLocation(id, c.postcodeInput);
        return rowToGuest(q.get.get(id));
      });
    },

    // ---------------------------------------------------------------- wishes
    /** A new lantern ("what do you need in life right now?"). Throws AuthError. */
    addWish(token, text) {
      const me = authorFor(token);
      const clean = cleanText(text, LIMITS.need);
      if (clean.length < 2) throw new ValidationError('Write a few words first', 'need');
      return tx(() => {
        const { lastInsertRowid } = q.wishInsert.run(me.id, clean);
        q.setNeed.run(clean, me.id);
        return { guest: rowToGuest(q.get.get(me.id)), wish: rowToWish(q.wishGet.get(Number(lastInsertRowid))) };
      });
    },

    listWishes: () => q.wishesAll.all().map(rowToWish),

    /** Moderation. Returns the guest whose wish it was, or null. */
    deleteWish(id) {
      return tx(() => {
        const w = q.wishGet.get(id);
        if (!w) return null;
        q.wishDel.run(id);
        q.setNeed.run(q.latestWish.get(w.guest_id)?.text ?? null, w.guest_id);
        return rowToGuest(q.get.get(w.guest_id));
      });
    },

    deleteGuest: (id) => q.del.run(id).changes > 0,

    deleteAllGuests: () =>
      tx(() => {
        q.secretsDelAll.run();
        q.wishesDelAll.run();
        return Number(q.delAll.run().changes);
      }),

    // ---------------------------------------------------------------- secrets
    listSecrets: () => q.secretsAll.all().map(rowToSecret),

    listSecretsAdmin: () =>
      q.secretsAdmin.all().map((r) => ({ ...rowToSecret(r), aboutName: r.about_name, authorId: r.author_id, authorName: r.author_name })),

    /** {text, about: 'me' | guestId}. Throws AuthError / ValidationError. */
    createSecret(token, input) {
      const me = authorFor(token);
      const src = input && typeof input === 'object' ? input : {};
      const text = cleanText(src.text, LIMITS.secret);
      if (text.length < 3) throw new ValidationError('Write a few words first', 'text');
      const aboutId = src.about === 'me' || src.about == null ? me.id : Number(src.about);
      if (!Number.isInteger(aboutId) || !q.get.get(aboutId)) throw new ValidationError('That person isn’t here (any more)', 'about');
      const by = aboutId === me.id ? 'self' : 'friend';
      const { lastInsertRowid } = q.secretInsert.run(text, aboutId, me.id, by, classify(text));
      return rowToSecret(q.secretGet.get(Number(lastInsertRowid)));
    },

    /** For seeding and tests: add a secret without a phone token. */
    addSecret({ text, aboutId, by = 'friend', authorId = null }) {
      const clean = cleanText(text, LIMITS.secret);
      const { lastInsertRowid } = q.secretInsert.run(clean, aboutId, authorId, by, classify(clean));
      return rowToSecret(q.secretGet.get(Number(lastInsertRowid)));
    },

    deleteSecret: (id) => q.secretDel.run(id).changes > 0,

    // ----------------------------------------------------------------- backup
    /** Everything, rows as stored (tokens included): for moving the party. */
    exportAll() {
      const out = { format: 'whoswho-backup', version: 1 };
      for (const [t, cols] of Object.entries(TABLES)) {
        out[t] = db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all().map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
      }
      return out;
    },

    /** Replace everything with a backup from exportAll. Returns row counts. */
    importAll(data) {
      if (!data || data.format !== 'whoswho-backup') throw new ValidationError('Not a whoswho backup', 'format');
      const rows = (t) => (Array.isArray(data[t]) ? data[t] : []);
      return tx(() => {
        for (const t of ['secrets', 'wishes', 'guests', 'settings']) db.exec(`DELETE FROM ${t}`);
        const counts = {};
        for (const t of ['guests', 'secrets', 'wishes', 'settings']) {
          const cols = TABLES[t];
          const ins = db.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
          for (const r of rows(t)) ins.run(...cols.map((c) => (r[c] === undefined ? null : r[c])));
          counts[t] = rows(t).length;
        }
        return counts;
      });
    },

    // --------------------------------------------------------------- settings
    getSettings() {
      const out = { ...DEFAULT_SETTINGS };
      for (const { key, value } of q.settingsAll.all()) {
        if (key in DEFAULT_SETTINGS) out[key] = JSON.parse(value);
      }
      // Views from older versions (graph, needs) no longer exist.
      const views = Array.isArray(out.views) ? VIEW_IDS.filter((v) => out.views.includes(v)) : [];
      out.views = views.length ? views : [...VIEW_IDS];
      return out;
    },

    /** Partial update; validates each known key. Returns the merged settings. */
    updateSettings(patch) {
      const src = patch && typeof patch === 'object' ? patch : {};
      const clean = {};
      if ('title' in src) {
        const t = cleanText(src.title, 60);
        clean.title = t || DEFAULT_SETTINGS.title;
      }
      if ('rotateSeconds' in src) {
        const n = Math.round(Number(src.rotateSeconds));
        if (!Number.isFinite(n) || n < 3 || n > 600) {
          throw new ValidationError('Rotation must be between 3 and 600 seconds', 'rotateSeconds');
        }
        clean.rotateSeconds = n;
      }
      if ('views' in src) {
        const views = Array.isArray(src.views) ? VIEW_IDS.filter((v) => src.views.includes(v)) : [];
        if (!views.length) throw new ValidationError('Enable at least one view', 'views');
        clean.views = views;
      }
      tx(() => {
        for (const [k, v] of Object.entries(clean)) q.settingsPut.run(k, JSON.stringify(v));
      });
      return this.getSettings();
    },
  };
}
