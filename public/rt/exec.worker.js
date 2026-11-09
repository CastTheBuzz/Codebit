// Runs a compiled C/C++ program with a tiny WASI layer: stdin, stdout, stderr, nothing else.
class Exit extends Error { constructor(c) { super('exit'); this.code = c; } }
const enc = new TextEncoder(), dec = new TextDecoder();
const cache = new Map();
self.onmessage = async e => {
  const { id, key, wasm, stdin } = e.data;
  try {
    let mod = cache.get(key);
    if (!mod) { mod = await WebAssembly.compile(wasm); cache.clear(); cache.set(key, mod); }
    const input = enc.encode(stdin);
    let pos = 0, out = '', errOut = '', mem;
    const view = () => new DataView(mem.buffer);
    const ov = (iovs, n) => { const v = view(), r = []; for (let i = 0; i < n; i++) r.push([v.getUint32(iovs + i * 8, true), v.getUint32(iovs + i * 8 + 4, true)]); return r; };
    const wasi = {
      fd_write(fd, iovs, n, ret) {
        let t = 0; const u = new Uint8Array(mem.buffer);
        for (const [p, l] of ov(iovs, n)) { const s = dec.decode(u.subarray(p, p + l)); if (fd === 2) errOut += s; else out += s; t += l; }
        if (out.length > 2e6) throw new Exit(-2);
        view().setUint32(ret, t, true); return 0;
      },
      fd_read(fd, iovs, n, ret) {
        let t = 0; const u = new Uint8Array(mem.buffer);
        if (fd === 0) for (const [p, l] of ov(iovs, n)) { const c = Math.min(l, input.length - pos); u.set(input.subarray(pos, pos + c), p); pos += c; t += c; if (c < l) break; }
        view().setUint32(ret, t, true); return 0;
      },
      fd_fdstat_get(fd, p) { if (fd > 2) return 8; const v = view(); v.setUint8(p, 2); v.setUint16(p + 2, 0, true); v.setBigUint64(p + 8, 0n, true); v.setBigUint64(p + 16, 0n, true); return 0; },
      fd_close: () => 0, fd_seek: () => 70, fd_prestat_get: () => 8, fd_prestat_dir_name: () => 8,
      args_sizes_get(a, b) { view().setUint32(a, 0, true); view().setUint32(b, 0, true); return 0; }, args_get: () => 0,
      environ_sizes_get(a, b) { view().setUint32(a, 0, true); view().setUint32(b, 0, true); return 0; }, environ_get: () => 0,
      clock_time_get(c, pr, p) { view().setBigUint64(p, BigInt(Math.round((c === 0 ? Date.now() : performance.now()) * 1e6)), true); return 0; },
      random_get(p, n) { crypto.getRandomValues(new Uint8Array(mem.buffer, p, Math.min(n, 65536))); return 0; },
      proc_exit(c) { throw new Exit(c); },
    };
    const imports = { wasi_snapshot_preview1: {} };
    for (const i of WebAssembly.Module.imports(mod)) imports[i.module] ||= {}, imports[i.module][i.name] = wasi[i.name] || (() => 52);
    const inst = await WebAssembly.instantiate(mod, imports);
    mem = inst.exports.memory;
    let err = '';
    try { inst.exports._start(); }
    catch (x) {
      if (x instanceof Exit) { if (x.code === -2) err = 'Too much output.'; else if (x.code) err = `Program exited with code ${x.code}.`; }
      else if (x instanceof WebAssembly.RuntimeError) err = /unreachable/.test(x.message) ? 'Program crashed (abort, or use of a bad value).' : /bounds/.test(x.message) ? 'Program crashed: invalid memory access.' : 'Program crashed: ' + x.message;
      else if (x instanceof RangeError) err = 'Program crashed: stack overflow.';
      else err = String(x);
    }
    self.postMessage({ id, out, err: err && errOut ? errOut + '\n' + err : err });
  } catch (x) { self.postMessage({ id, out: '', err: String(x) }); }
};
self.postMessage({ ready: true });
