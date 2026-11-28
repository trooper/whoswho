// The Durable Object's SQLite storage behind the same small driver interface
// as Node's node:sqlite (src/node-db.js), so src/db.js runs unchanged.

export function durableDriver(storage) {
  const sql = storage.sql;
  // PRAGMA user_version isn't available here: keep the schema version in a table.
  sql.exec('CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)');
  const first = (q, ...args) => sql.exec(q, ...args).toArray()[0];
  return {
    exec: (q) => { sql.exec(q); },
    prepare: (q) => ({
      run(...args) {
        sql.exec(q, ...args);
        const r = first('SELECT last_insert_rowid() AS id, changes() AS n');
        return { lastInsertRowid: r.id, changes: r.n };
      },
      get: (...args) => first(q, ...args),
      all: (...args) => sql.exec(q, ...args).toArray(),
    }),
    tx: (fn) => storage.transactionSync(fn),
    version: () => first("SELECT v FROM _meta WHERE k = 'version'")?.v ?? 0,
    setVersion: (v) => { sql.exec("INSERT INTO _meta (k, v) VALUES ('version', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", v); },
    close() {},
  };
}
