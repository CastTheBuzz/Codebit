// Your data: progress, drafts, settings. Kept on the device and synced to Codebit's server.
const LS_KEY = 'cb_state_v1', LS_META = 'cb_meta_v1';
let S = {}, meta = { since: 0, dirty: [] }, timer = null, syncing = null;
const listeners = new Set();
try { S = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); meta = { since: 0, dirty: [], ...JSON.parse(localStorage.getItem(LS_META) || '{}') }; } catch {}
const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); localStorage.setItem(LS_META, JSON.stringify(meta)); } catch {} };

export class AuthError extends Error {}
export async function api(path, opts = {}) {
  const o = { credentials: 'same-origin', ...opts, headers: { ...(opts.body && typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) } };
  let r;
  try { r = await fetch(path, o); } catch { throw new Error('No internet connection.'); }
  if (r.status === 401) { let m = 'Please sign in'; try { m = (await r.json()).error || m; } catch {} throw new AuthError(m); }
  if (!r.ok) { let m = `Error ${r.status}`; try { m = (await r.json()).error || m; } catch {} throw new Error(m); }
  return r;
}

export const get = (k, d = undefined) => (S[k] && S[k].v !== null && S[k].v !== undefined ? S[k].v : d);
export function set(k, v) {
  S[k] = { v: v === undefined ? null : v, u: Date.now() };
  if (!meta.dirty.includes(k)) meta.dirty.push(k);
  persist();
  listeners.forEach(f => f(k));
  clearTimeout(timer);
  timer = setTimeout(() => sync().catch(() => {}), 4000);
}
export const del = k => set(k, null);
export const keys = prefix => Object.keys(S).filter(k => k.startsWith(prefix) && S[k].v !== null && S[k].v !== undefined);
export const onChange = f => (listeners.add(f), () => listeners.delete(f));
export const lastSync = () => meta.lastOk || 0;
export const pending = () => meta.dirty.length;

export function sync({ beacon = false } = {}) {
  if (syncing) return syncing;
  syncing = (async () => {
    const sending = meta.dirty.slice();
    if (sending.length) {
      const items = sending.map(k => ({ k, v: S[k] ? S[k].v : null, u: S[k] ? S[k].u : Date.now() }));
      const sentU = Object.fromEntries(items.map(i => [i.k, i.u]));
      for (let i = 0; i < items.length; i += 400) {
        await api('/api/state', { method: 'POST', body: JSON.stringify({ items: items.slice(i, i + 400) }), keepalive: beacon && items.length < 50 });
      }
      meta.dirty = meta.dirty.filter(k => !(k in sentU) || (S[k] && S[k].u !== sentU[k]));
    }
    if (beacon) { persist(); return; }
    let more = true, changed = false;
    while (more) {
      const r = await (await api('/api/state?since=' + meta.since + '&after=' + encodeURIComponent(meta.sinceK || ''))).json();
      for (const it of r.items) {
        const cur = S[it.k];
        if (!cur || it.u > cur.u) { S[it.k] = { v: it.v, u: it.u }; changed = true; }
      }
      more = r.more && r.items.length > 0;
      if (more) { const last = r.items[r.items.length - 1]; meta.since = last.s; meta.sinceK = last.k; }
      else { const ns = Math.max(meta.since, r.now - 2000); if (ns !== meta.since) meta.sinceK = ''; meta.since = ns; }
    }
    meta.lastOk = Date.now();
    persist();
    if (changed) listeners.forEach(f => f('*'));
  })().finally(() => { syncing = null; });
  return syncing;
}
export function wipeLocal() { S = {}; meta = { since: 0, dirty: [] }; persist(); }
