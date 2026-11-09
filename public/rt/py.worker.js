// Runs Python on the device (Pyodide).
import { loadPyodide } from '/rt/py/pyodide.mjs';
const py = await loadPyodide({ indexURL: '/rt/py/' });
py.runPython(`
import sys, io, traceback
def __run(src, stdin):
    sys.stdin = io.StringIO(stdin)
    out = io.StringIO()
    sys.stdout = out
    err = ''
    g = {'__name__': '__main__'}
    try:
        exec(compile(src, 'main.py', 'exec'), g)
    except SystemExit:
        pass
    except BaseException as e:
        tb = e.__traceback__.tb_next if e.__traceback__ else None
        err = ''.join(traceback.format_exception(type(e), e, tb))
    sys.stdout = sys.__stdout__
    return [out.getvalue(), err]
`);
const run = py.globals.get('__run');
self.onmessage = e => {
  const { id, code, stdin } = e.data;
  try {
    const p = run(code, stdin), [out, err] = p.toJs(); p.destroy();
    self.postMessage({ id, out, err });
  } catch (x) { self.postMessage({ id, out: '', err: String(x) }); }
};
self.postMessage({ ready: true });
