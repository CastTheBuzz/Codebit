// Compiles C and C++ on the device (real Clang, in WebAssembly).
const gz = { 'llvm.core.wasm': 'application/wasm', 'llvm-resources.tar': 'application/x-tar' };
const realFetch = self.fetch.bind(self);
self.fetch = async (u, o) => {
  const name = String(u).split('/').pop();
  if (gz[name]) {
    const r = await realFetch('/rt/cc/' + name + '.gz.bin');
    if (!r.ok) throw new Error('Could not download the compiler');
    return new Response(r.body.pipeThrough(new DecompressionStream('gzip')), { headers: { 'content-type': gz[name] } });
  }
  return realFetch(u, o);
};
const { commands } = await import('/rt/cc/bundle.js');
const dec = new TextDecoder();
const FLAGS = { cpp: ['-std=c++20', '-O1', '-fno-exceptions', '-Wl,--strip-all'], c: ['-std=c17', '-O1', '-Wl,--strip-all'] };
self.onmessage = async e => {
  const { id, code, lang } = e.data;
  const file = lang === 'cpp' ? 'main.cpp' : 'main.c', cmd = lang === 'cpp' ? 'clang++' : 'clang';
  let log = '';
  const sink = b => { if (b) log += dec.decode(b); };
  try {
    const out = await commands[cmd]([...FLAGS[lang], file, ...(lang === 'c' ? ['-lm'] : []), '-o', 'a.wasm'], { [file]: code }, { stdout: sink, stderr: sink, fetchProgress: () => {} });
    self.postMessage({ id, wasm: out['a.wasm'] });
  } catch (x) {
    self.postMessage({ id, err: log || String(x) });
  }
};
self.postMessage({ ready: true });
