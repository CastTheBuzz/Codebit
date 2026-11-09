// Runs JavaScript on the device, one program at a time. input() gives the next line of input.
const AsyncFunction = (async () => {}).constructor;
const fmt = v => typeof v === 'string' ? v : show(v, 0);
function show(v, d) {
  if (typeof v === 'string') return d ? `'${v}'` : v;
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? `[Function: ${v.name || 'anonymous'}]` : String(v);
  if (d > 3) return Array.isArray(v) ? '[Array]' : '[Object]';
  if (Array.isArray(v)) return v.length ? `[ ${v.map(x => show(x, d + 1)).join(', ')} ]` : '[]';
  if (v instanceof Error) return String(v);
  if (v instanceof Map) return `Map(${v.size}) { ${[...v].map(([a, b]) => show(a, d + 1) + ' => ' + show(b, d + 1)).join(', ')} }`;
  if (v instanceof Set) return `Set(${v.size}) { ${[...v].map(x => show(x, d + 1)).join(', ')} }`;
  const k = Object.keys(v), n = v.constructor && v.constructor !== Object ? v.constructor.name + ' ' : '';
  return k.length ? `${n}{ ${k.map(x => x + ': ' + show(v[x], d + 1)).join(', ')} }` : n + '{}';
}
self.onmessage = async e => {
  const { id, code, stdin } = e.data;
  let out = '', err = '';
  const lines = stdin.replace(/\n$/, '').split('\n');
  if (stdin === '') lines.length = 0;
  let i = 0, timers = 0, wake = null;
  const log = (...a) => { out += a.map(fmt).join(' ') + '\n'; };
  const con = { log, info: log, error: log, warn: log };
  const input = () => (i < lines.length ? lines[i++] : null);
  const st = (f, ms, ...a) => { timers++; return setTimeout(() => { timers--; try { f(...a); } catch (x) { err ||= String(x); } if (!timers && wake) wake(); }, ms); };
  const onRej = ev => { err ||= String(ev.reason); ev.preventDefault(); if (wake) wake(); };
  self.addEventListener('unhandledrejection', onRej);
  try {
    await new AsyncFunction('console', 'input', 'setTimeout', code + '\n')(con, input, st);
    if (timers) await new Promise(r => { wake = r; });
    await new Promise(r => setTimeout(r, 0));
  } catch (x) { err = x && x.stack ? String(x) + lineOf(x) : String(x); }
  self.removeEventListener('unhandledrejection', onRej);
  self.postMessage({ id, out, err });
};
const lineOf = x => { const m = String(x.stack).match(/<anonymous>:(\d+):\d+/); return m ? ` (near line ${Math.max(1, m[1] - 2)})` : ''; };
self.postMessage({ ready: true });
