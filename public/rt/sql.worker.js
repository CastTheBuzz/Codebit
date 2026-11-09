// Runs SQL on the device (SQLite). Each run gets a fresh database.
importScripts('/rt/sql/sql-wasm.js');
const fmt = v => v === null ? 'NULL' : v instanceof Uint8Array ? '<blob>' : String(v);
initSqlJs({ locateFile: f => '/rt/sql/' + f }).then(SQL => {
  self.onmessage = e => {
    const { id, code, stdin, check } = e.data;
    const db = new SQL.Database();
    let out = '', err = '';
    try {
      db.run(stdin);
      let res = db.exec(code);
      if (check) res = db.exec(check);
      const last = res[res.length - 1];
      if (last) out = last.values.map(r => r.map(fmt).join('|')).join('\n') + '\n';
    } catch (x) { err = String(x.message || x); }
    db.close();
    self.postMessage({ id, out, err });
  };
  self.postMessage({ ready: true });
});
