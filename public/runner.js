// Runs code in background workers so a stuck program can always be stopped.
export const LANGS = {
  python: { name: 'Python', worker: '/rt/py.worker.js', module: true },
  js: { name: 'JavaScript', worker: '/rt/js.worker.js', module: false },
  cpp: { name: 'C++', worker: '/rt/exec.worker.js', module: false, compiled: true },
  c: { name: 'C', worker: '/rt/exec.worker.js', module: false, compiled: true },
  sql: { name: 'SQL', worker: '/rt/sql.worker.js', module: false },
};
const LIMIT = 15000;
let seq = 0;
const pool = {};

function spawn(url, module) {
  const w = new Worker(url, module ? { type: 'module' } : {});
  const slot = { w, ready: null, cbs: new Map(), dead: false };
  slot.ready = new Promise((res, rej) => {
    slot.fail = rej;
    w.onmessage = e => {
      if (e.data.ready) return res();
      const cb = slot.cbs.get(e.data.id);
      if (cb) { slot.cbs.delete(e.data.id); cb(e.data); }
    };
    w.onerror = e => { const m = e.message || 'Could not start this language. Check your connection and try again.'; rej(new Error(m)); for (const cb of slot.cbs.values()) cb({ err: m, out: '' }); slot.cbs.clear(); kill(url); };
  });
  return slot;
}
function kill(url) { const s = pool[url]; if (s) { s.w.terminate(); delete pool[url]; } }
const get = (url, module) => (pool[url] ||= spawn(url, module));
function call(url, module, msg, limit) {
  const s = get(url, module);
  return s.ready.then(() => new Promise(res => {
    const id = ++seq;
    const t = limit && setTimeout(() => { s.cbs.delete(id); kill(url); res({ out: '', err: `Stopped after ${limit / 1000} seconds. Is there an endless loop, or is the approach too slow?`, timeout: true }); }, limit);
    s.cbs.set(id, d => { clearTimeout(t); res(d); });
    s.w.postMessage({ ...msg, id });
  }), e => { kill(url); return { out: '', err: e.message }; });
}

let lastBuild = { key: null, wasm: null };
async function hash(s) { const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

// First C/C++ use downloads the compiler once. Shows real progress.
export async function compilerReady(onProgress) {
  const url = '/rt/cc/llvm.core.wasm.gz.bin';
  const c = await caches.open('cb-rt-1').catch(() => null);
  if (c && await c.match(url)) return true;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Could not download the compiler.');
  const total = +r.headers.get('content-length') || 22.7e6, rd = r.clone().body.getReader();
  let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; got += value.length; onProgress?.(got / total); }
  if (c) await c.put(url, r);
  return true;
}
export async function isCached(lang) {
  const url = lang === 'python' ? '/rt/py/pyodide.asm.wasm' : lang === 'sql' ? '/rt/sql/sql-wasm.wasm' : lang === 'js' ? null : '/rt/cc/llvm.core.wasm.gz.bin';
  if (!url) return true;
  const c = await caches.open('cb-rt-1').catch(() => null);
  return !!(c && await c.match(url));
}

async function build(lang, code, status) {
  const key = lang + await hash(code);
  if (lastBuild.key === key) return { key, wasm: lastBuild.wasm };
  if (!(await isCached(lang))) { status?.('Downloading the compiler (about 27 MB, only once)…'); await compilerReady(p => status?.(`Downloading the compiler: ${Math.min(100, Math.round(p * 100))}%`)); }
  status?.('Compiling…');
  const r = await call('/rt/cc.worker.js', true, { code, lang }, 120000);
  if (r.err || !r.wasm) return { compileErr: cleanErr(r.err || 'Compile failed') };
  lastBuild = { key, wasm: r.wasm };
  return { key, wasm: r.wasm };
}
const cleanErr = s => s.split('\n').filter(l => !/^(clang|wasm-ld)(\+\+)?: error: linker|^Thread model|^InstalledDir|^Build config|^Target:|^clang version/.test(l)).join('\n').trim();

// Runs one program once. Returns { out, err }.
export async function run({ lang, code, stdin = '', check, status, limit = LIMIT }) {
  const L = LANGS[lang];
  if (L.compiled) {
    const b = await build(lang, code, status);
    if (b.compileErr) return { out: '', err: b.compileErr, compile: true };
    status?.('Running…');
    return call('/rt/exec.worker.js', false, { key: b.key, wasm: b.wasm, stdin }, limit);
  }
  status?.(lang === 'python' && !pool[L.worker] ? 'Starting Python…' : 'Running…');
  await get(L.worker, L.module).ready.catch(() => {});
  return call(L.worker, L.module, { code, stdin, check }, limit);
}

export const clean = s => String(s).replace(/\r/g, '').split('\n').map(l => l.trimEnd()).join('\n').replace(/\n+$/, '');
export const same = (a, b, any) => {
  a = clean(a); b = clean(b);
  if (any) { a = a.split('\n').sort().join('\n'); b = b.split('\n').sort().join('\n'); }
  return a === b;
};
export const fullCode = (task, lang, code) => code + (task.h?.[lang] ? '\n' + task.h[lang] : '');

// Big hidden tests are generated on the device from a fixed seed, so they are the same every time.
export function rng(seed) {
  let s = seed * 2654435761 >>> 0;
  const next = () => (s = Math.imul(s, 1664525) + 1013904223 >>> 0, (s ^ s >>> 15) >>> 0);
  const R = {
    int: (a, b) => a + next() % (b - a + 1),
    arr: (n, a, b) => Array.from({ length: n }, () => R.int(a, b)),
    str: (n, abc = 'abcdefghijklmnopqrstuvwxyz') => Array.from({ length: n }, () => abc[R.int(0, abc.length - 1)]).join(''),
  };
  return R;
}

// Runs all tests. Stops at the first failure so you fix one thing at a time.
export async function check(task, lang, code, { status, onTest } = {}) {
  const src = fullCode(task, lang, code);
  const res = [];
  for (let i = 0; i < task.tests.length; i++) {
    const t = task.tests[i];
    if (t.i === undefined) t.i = new Function('R', t.gen)(rng(i + 1));
    status?.(`Test ${i + 1} of ${task.tests.length}…`);
    const r = await run({ lang, code: src, stdin: t.i, check: task.check, limit: task.limit || LIMIT, status: x => status?.(x === 'Running…' ? `Test ${i + 1} of ${task.tests.length}…` : x) });
    const pass = !r.err && same(r.out, t.o, task.any);
    res.push({ pass, got: r.out, err: r.err, compile: r.compile, timeout: r.timeout, i });
    onTest?.(res[i]);
    if (!pass) break;
  }
  return res;
}
