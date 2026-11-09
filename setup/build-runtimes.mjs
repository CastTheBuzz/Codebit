// Copies the language runtimes into public/rt so Cloudflare serves them. Files over 25 MB are stored gzipped.
import { copyFileSync, mkdirSync, existsSync, createReadStream, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip, constants } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NM = join(ROOT, 'node_modules'), RT = join(ROOT, 'public', 'rt');
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };

export async function buildRuntimes({ force = false } = {}) {
  for (const f of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) copy(join(NM, 'pyodide', f), join(RT, 'py', f));
  for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) copy(join(NM, 'sql.js', 'dist', f), join(RT, 'sql', f));
  const gen = join(NM, '@yowasp', 'clang', 'gen');
  for (const f of ['bundle.js', 'llvm.core2.wasm', 'llvm.core3.wasm', 'llvm.core4.wasm']) copy(join(gen, f), join(RT, 'cc', f));
  for (const f of ['llvm.core.wasm', 'llvm-resources.tar']) {
    const to = join(RT, 'cc', f + '.gz.bin');
    if (existsSync(to) && !force) continue;
    await pipeline(createReadStream(join(gen, f)), createGzip({ level: constants.Z_BEST_COMPRESSION }), createWriteStream(to));
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildRuntimes();
