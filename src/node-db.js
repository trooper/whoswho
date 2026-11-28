// Node: the guest board's data in one SQLite file (node:sqlite). The Worker
// uses the Durable Object's own SQLite instead (worker/sqlite-driver.js).

import { DatabaseSync } from 'node:sqlite';
import { createStore } from './db.js';

export function nodeDriver(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    tx(fn) {
      db.exec('BEGIN');
      try {
        const out = fn();
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    version: () => db.prepare('PRAGMA user_version').get().user_version,
    setVersion: (v) => db.exec(`PRAGMA user_version = ${Number(v)}`),
    close: () => db.close(),
  };
}

export function openDb(file = process.env.DB_PATH || 'whoswho.sqlite') {
  return createStore(nodeDriver(file));
}

