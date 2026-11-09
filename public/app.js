import * as store from './store.js';
import { LANGS, run, check, same, clean, fullCode, compilerReady, isCached } from './runner.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = $('#main');
const DAY = 864e5;
const TICK = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 21l10 11L35 7" fill="none" stroke="var(--red)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const COLORS = { python: 'var(--py)', js: 'var(--js)', cpp: 'var(--cpp)', c: 'var(--c)', sql: 'var(--sql)', algo: 'var(--algo)', devops: 'var(--devops)' };
let C, byId = new Map(), order = [];
let cleanup = null;

// ---------- small markdown for theory and task text ----------
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\((https:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1<em>$2</em>');
}
function md(src) {
  const out = []; const lines = String(src).replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    if (l.startsWith('```')) { const b = []; i++; while (i < lines.length && !lines[i].startsWith('```')) b.push(lines[i++]); i++; out.push(`<pre><code>${esc(b.join('\n'))}</code></pre>`); continue; }
    if (/^#{1,3} /.test(l)) { const n = l.match(/^#+/)[0].length + 1; out.push(`<h${n}>${inline(l.slice(n))}</h${n}>`); i++; continue; }
    if (/^- /.test(l)) { const b = []; while (i < lines.length && /^- /.test(lines[i])) b.push(`<li>${inline(lines[i++].slice(2))}</li>`); out.push(`<ul>${b.join('')}</ul>`); continue; }
    if (/^\d+\. /.test(l)) { const b = []; while (i < lines.length && /^\d+\. /.test(lines[i])) b.push(`<li>${inline(lines[i++].replace(/^\d+\. /, ''))}</li>`); out.push(`<ol>${b.join('')}</ol>`); continue; }
    if (!l.trim()) { i++; continue; }
    const b = []; while (i < lines.length && lines[i].trim() && !/^(```|#{1,3} |- |\d+\. )/.test(lines[i])) b.push(lines[i++]);
    out.push(`<p>${inline(b.join(' '))}</p>`);
  }
  return out.join('');
}

// ---------- progress ----------
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isDone = id => !!store.get('done:' + id);
const STEPS = [3, 7, 21, 60, 150];
function markSolved(task, lang, { review, fails }) {
  const k = 'done:' + task.id, was = store.get(k);
  if (!was) store.set(k, { t: Date.now(), lang });
  const d = 'day:' + today(); store.set(d, (store.get(d, 0) || 0) + 1);
  if (task.kind === 'predict' || task.kind === 'lab') return;
  const r = store.get('rev:' + task.id);
  if (!was || !r) store.set('rev:' + task.id, { due: Date.now() + STEPS[0] * DAY, step: 0 });
  else if (review) { const step = fails > 1 ? Math.max(0, r.step - 1) : Math.min(STEPS.length - 1, r.step + 1); store.set('rev:' + task.id, { due: Date.now() + STEPS[step] * DAY, step }); }
}
function streak() {
  let n = 0; const d = new Date();
  if (!store.get('day:' + today(d))) d.setDate(d.getDate() - 1);
  while (store.get('day:' + today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const modTasks = m => m.tasks;
const trackTasks = t => t.modules.flatMap(modTasks);
const nextIn = t => trackTasks(t).find(x => !isDone(x.id));
const langOf = task => { const t = task.track; return task.lang || store.get('lang:' + t.id) || 'python'; };
function dueReviews() {
  const now = Date.now();
  return store.keys('rev:').map(k => ({ id: k.slice(4), ...store.get(k) })).filter(r => r.due <= now && byId.has(r.id)).sort((a, b) => a.due - b.due);
}
// Problem solving needs lists, so Today holds it back until the basics are done. The roadmap stays open.
function algoOpen() {
  const lists = C.tracks.find(t => t.id === 'python')?.modules.find(m => m.id === 'lists');
  return !!lists?.tasks.every(x => isDone(x.id)) || order.filter(x => x.track.id !== 'algo' && isDone(x.id)).length >= 35;
}
function dailyPlan() {
  const k = 'plan:' + today();
  const saved = store.get(k);
  if (saved && saved.every(p => byId.has(p.id)) && (algoOpen() || !saved.some(p => byId.get(p.id).track.id === 'algo'))) return saved;
  const cur = C.tracks.find(t => t.id === store.get('cur')) || C.tracks.find(t => t.id !== 'algo');
  const algo = C.tracks.find(t => t.id === 'algo');
  const plan = [], used = new Set(), add = (id, review) => { if (id && !used.has(id)) { used.add(id); plan.push({ id, review: !!review }); } };
  add(nextIn(cur)?.id);
  if (algo && algoOpen()) add(nextIn(algo)?.id);
  add(dueReviews()[0]?.id, true);
  if (cur.id === 'devops') add(C.tracks.filter(t => t.id !== 'devops' && t.id !== 'algo').map(nextIn).find(Boolean)?.id);
  for (const x of trackTasks(cur)) { if (plan.length >= 3) break; if (!isDone(x.id)) add(x.id); }
  if (plan.length < 3) { const p = order.find(x => !isDone(x.id) && !used.has(x.id)); add(p?.id); }
  store.set(k, plan);
  return plan;
}

// ---------- screens ----------
function setTab(t) { document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === t)); document.body.classList.toggle('work', t === 'work'); }
function row(task, sub, href, done) {
  const d = done ?? isDone(task.id);
  return `<li><a href="${href || '#/do/' + task.id}"><span class="dot ${d ? 'done' : ''}">${d ? TICK : ''}</span><span class="b"><span class="t">${esc(task.title)}</span><br><span class="s">${esc(sub || '')}</span></span>${task.kind === 'predict' ? '<span class="tag">read it</span>' : task.kind === 'fix' ? '<span class="tag">fix it</span>' : task.kind === 'lab' ? '<span class="tag">lab</span>' : task.d === 3 ? '<span class="tag">hard</span>' : ''}</a></li>`;
}
function viewToday() {
  setTab('today');
  const plan = dailyPlan();
  const week = []; const d = new Date(); d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) { const k = today(d), n = store.get('day:' + k); week.push(`<i class="${n ? 'hit' : ''} ${k === today() ? 'now' : ''}">${n || d.toLocaleDateString('en', { weekday: 'narrow' })}</i>`); d.setDate(d.getDate() + 1); }
  const s = streak(), left = plan.filter(p => !(isDoneToday(p))).length;
  const rev = dueReviews().length;
  main.innerHTML = `<div class="page">
    <div class="date">${new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <h1>${left ? `${left} ${left === 1 ? 'task' : 'tasks'} today` : 'Done for today'}</h1>
    <div class="streak muted">${s ? `${s}-day streak` : 'Solve one task to start a streak.'}</div>
    <div class="week">${week.join('')}</div>
    ${left ? '' : keepGoing()}<div class="sheet"><ul class="rows">${plan.map(p => { const t = byId.get(p.id); return row(t, (p.review ? 'Review from a blank page: ' : '') + `${t.mod.title} (${t.track.name})`, `#/do/${t.id}${p.review ? '?review=1' : ''}`, !!isDoneToday(p)); }).join('') || '<li class="muted">You finished the whole course.</li>'}</ul></div>
    ${rev > 1 ? `<div class="sheet"><h2>Reviews due</h2><ul class="rows">${dueReviews().slice(0, 8).map(r => { const t = byId.get(r.id); return row(t, t.track.name, `#/do/${t.id}?review=1`, false); }).join('')}</ul></div>` : ''}
  </div>`;
}
function keepGoing() {
  const cur = C.tracks.find(t => t.id === store.get('cur')) || C.tracks[0];
  const nx = nextIn(cur) || order.find(x => !isDone(x.id));
  return nx ? `<p style="margin-top:16px"><a class="btn" href="#/do/${nx.id}">Keep going</a></p><p class="muted">Next: ${esc(nx.title)} (${esc(nx.track.name)})</p>` : '';
}
const isDoneToday = p => { const s = store.get('sol:' + p.id); return s && today(new Date(s.t)) === today(); };
function viewMap() {
  setTab('map');
  main.innerHTML = `<div class="page"><h1>Roadmap</h1><input class="search" id="q" type="search" placeholder="Search theory and tasks, like chmod" aria-label="Search theory and tasks" autocomplete="off"><div id="found"></div><div class="lines" id="lines">${C.tracks.map(t => {
    const all = trackTasks(t), n = all.filter(x => isDone(x.id)).length;
    return `<a class="line" style="--c:${COLORS[t.id]}" href="#/t/${t.id}"><h2>${esc(t.name)}</h2><div class="muted">${esc(t.blurb)}</div><div class="bar"><i style="width:${all.length ? n / all.length * 100 : 0}%"></i></div><div class="muted" style="font-size:.86rem;margin-top:4px">${n} of ${all.length} tasks</div></a>`;
  }).join('')}</div></div>`;
  $('#q').oninput = e => {
    const q = e.target.value.trim().toLowerCase(), f = $('#found');
    $('#lines').hidden = !!q;
    if (!q) { f.innerHTML = ''; return; }
    const out = [];
    for (const t of C.tracks) for (const m of t.modules) {
      if ((m.title + m.theory).toLowerCase().includes(q)) out.push(`<li><a href="#/m/${t.id}/${m.id}"><span class="b"><span class="t">${esc(m.title)}</span><br><span class="s">Theory in ${esc(t.name)}</span></span></a></li>`);
      for (const x of m.tasks) if ((x.title + ' ' + (x.body || '')).toLowerCase().includes(q)) out.push(`<li><a href="#/do/${x.id}"><span class="b"><span class="t">${esc(x.title)}</span><br><span class="s">${x.kind === 'lab' ? 'Lab' : 'Task'} in ${esc(t.name)}</span></span></a></li>`);
    }
    f.innerHTML = `<div class="sheet">${out.length ? `<ul class="rows">${out.slice(0, 40).join('')}</ul>` : '<p class="muted" style="margin:0">Nothing found. Try a shorter word.</p>'}</div>`;
  };
}
function viewTrack(id) {
  const t = C.tracks.find(x => x.id === id); if (!t) return go('#/map');
  setTab('map');
  if (id !== 'algo') store.set('cur', id);
  let found = false;
  main.innerHTML = `<div class="page"><a href="#/map" class="muted">Roadmap</a><h1>${esc(t.name)}</h1><div class="muted">${esc(t.blurb)}</div>
    ${t.langs ? `<p>Solve these in <select id="tl">${t.langs.map(l => `<option value="${l}" ${l === (store.get('lang:' + t.id) || 'python') ? 'selected' : ''}>${LANGS[l].name}</option>`).join('')}</select></p>` : ''}
    <div class="route" style="--c:${COLORS[t.id]}">${t.modules.map(m => {
      const n = m.tasks.filter(x => isDone(x.id)).length, full = n === m.tasks.length, now = !full && !found; if (now) found = true;
      return `<div class="stop ${full ? 'full' : ''} ${now ? 'now' : ''}"><a href="#/m/${t.id}/${m.id}"><b>${esc(m.title)}</b><span class="muted" style="font-size:.86rem">${n} of ${m.tasks.length}</span><div class="bar"><i style="width:${n / m.tasks.length * 100}%"></i></div></a></div>`;
    }).join('')}</div></div>`;
  $('#tl')?.addEventListener('change', e => store.set('lang:' + t.id, e.target.value));
}
function viewModule(tid, mid) {
  const t = C.tracks.find(x => x.id === tid), m = t?.modules.find(x => x.id === mid); if (!m) return go('#/map');
  setTab('map');
  main.innerHTML = `<div class="page"><a href="#/t/${t.id}" class="muted">${esc(t.name)}</a><h1>${esc(m.title)}</h1>
    ${(() => { const nx = m.tasks.find(x => !isDone(x.id)); return nx ? `<p style="margin-top:14px"><a class="btn" href="#/do/${nx.id}">${m.tasks.some(x => isDone(x.id)) ? 'Continue' : 'Start tasks'}</a></p><p class="muted">Next: ${esc(nx.title)}</p>` : '<p class="muted">All tasks in this stage are done.</p>'; })()}
    <div class="sheet prose">${md(m.theory)}</div>
    <div class="sheet"><h2>Tasks</h2><ul class="rows">${m.tasks.map(x => row(x, ['', 'Easy', 'Medium', 'Hard'][x.d] || '')).join('')}</ul></div></div>`;
  scrollTo(0, 0);
}

// ---------- the task screen ----------
let lastList = null;
const backOf = task => lastList || `#/m/${task.track.id}/${task.mod.id}`;
const beginner = () => order.filter(t => isDone(t.id)).length < 10;
const theoryBox = task => `<details class="theory"><summary>Theory: ${esc(task.mod.title)}</summary><div class="prose">${md(task.mod.theory)}</div></details>`;
const KEYS = { common: ['⇥', '(', ')', '{', '}', '[', ']', '"', "'", '=', ':', ';', ',', '.', '<', '>', '+', '-', '*', '/', '%', '_', '!', '&', '|', '#', '\\'] };
let EdLib = null;
async function makeEditor(host, lang, doc, onChange) {
  const E = EdLib ||= await import('./vendor/editor.js');
  const hl = E.HighlightStyle.define([
    { tag: E.tags.keyword, color: 'var(--cpp)', fontWeight: '600' }, { tag: [E.tags.string, E.tags.special(E.tags.string)], color: 'var(--sql)' },
    { tag: E.tags.comment, color: 'var(--soft)', fontStyle: 'italic' }, { tag: [E.tags.number, E.tags.bool, E.tags.null], color: 'var(--js)' },
    { tag: [E.tags.function(E.tags.variableName), E.tags.definition(E.tags.function(E.tags.variableName))], color: 'var(--py)' },
  ]);
  const langExt = { python: E.python, js: E.javascript, cpp: E.cpp, c: E.cpp, sql: E.sql }[lang]();
  return new E.EditorView({
    parent: host,
    state: E.EditorState.create({ doc, extensions: [
      E.lineNumbers(), E.history(), E.drawSelection(), E.highlightActiveLine(), E.indentOnInput(), E.bracketMatching(), E.syntaxHighlighting(hl), langExt,
      E.indentUnit.of('    '), E.EditorState.tabSize.of(4), E.keymap.of([...E.defaultKeymap, ...E.historyKeymap, E.indentWithTab]),
      E.EditorView.lineWrapping, E.EditorView.contentAttributes.of({ autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
      E.EditorView.updateListener.of(u => { if (u.docChanged) onChange(u.state.doc.toString()); }),
    ] }),
  });
}
const nextTask = task => { const i = order.indexOf(task), t = order.slice(i + 1).find(x => x.track === task.track && !isDone(x.id)); return t; };

function failBox(task, r, tests) {
  const t = task.tests[r.i], shown = r.i < (task.shown ?? 2);
  if (r.compile) return `<div class="verdict no">Does not compile</div><pre class="bad">${esc(r.err)}</pre>`;
  let h = `<div class="verdict no">${shown ? `Test ${r.i + 1} failed` : `Hidden test ${r.i + 1} failed`}</div>`;
  if (r.timeout) return h + `<pre class="bad">${esc(r.err)}</pre>`;
  if (r.err) h += `<h3>Error</h3><pre class="bad">${esc(r.err)}</pre>`;
  if (shown) {
    h += `${task.lang === 'sql' ? '' : `<h3>Input</h3><pre>${esc(clean(t.i)) || '(none)'}</pre>`}<div class="cmp"><div><h3>Expected</h3><pre>${esc(clean(t.o)) || '(nothing)'}</pre></div>${r.err ? '' : `<div><h3>Your output</h3><pre>${esc(clean(r.got)) || '(nothing)'}</pre></div>`}</div>`;
  }
  return h;
}

async function viewTask(id, q) {
  const task = byId.get(id); if (!task) return go('#/');
  setTab('work');
  const review = q.get('review') === '1';
  if (task.track.id !== 'algo') store.set('cur', task.track.id);
  if (task.kind === 'predict') return viewPredict(task);
  if (task.kind === 'lab') return viewLab(task);
  let lang = task.lang || (task.langs && (store.get('lang:' + task.track.id) || task.langs[0]));
  const back = backOf(task);
  let fails = 0;
  const startCode = l => (task.starter?.[l] ?? C.blank[l] ?? '');
  const prevStep = l => { if (!/^Step [2-9]/.test(task.title)) return undefined; const p = task.mod.tasks[task.mod.tasks.indexOf(task) - 1]; return p && store.get(`draft:${p.id}:${l}`); };
  const load = l => review ? (store.get('rev-draft:' + id + ':' + l) ?? startCode(l)) : (store.get(`draft:${id}:${l}`) ?? prevStep(l) ?? startCode(l));
  const save = (l, code) => store.set(`${review ? 'rev-draft' : 'draft'}:${id}${review ? ':' : ':'}${l}`, code);
  main.innerHTML = `<div class="ws" id="ws">
    <div class="ws-top"><a class="back" href="${back}" aria-label="Back to ${esc(task.mod.title)}">‹ Back</a><span class="ti">${esc(task.title)}</span>
      ${task.langs ? `<select id="lang" aria-label="Language">${task.langs.map(l => `<option value="${l}" ${l === lang ? 'selected' : ''}>${LANGS[l].name}</option>`).join('')}</select>` : `<span class="tag">${LANGS[lang].name}</span>`}</div>
    <div class="ws-tabs"><button data-p="task" class="on">Task</button><button data-p="code">Code</button><button data-p="res">Result</button></div>
    <div class="ws-body">
      <div class="pane task show"><div class="prose">${review ? '<p class="muted">Review: solve it again from a blank page.</p>' : ''}${md(task.body)}
        ${beginner() ? `<p class="note">${task.lang === 'sql' ? 'Your query also runs on a hidden database with different data, so write it for any data, not just the result shown here. Any query that gives the right rows counts.' : task.h ? 'Hidden code calls your code with different values, so it has to work for any value, not just the examples. Any method that gives the right result counts.' : 'Your program runs once for each test, with different input each time. Read the input in your code. Do not type the example values into it. Any method that gives the right output counts.'}</p>` : ''}
        ${theoryBox(task)}
        ${task.hint ? '<p><button class="btn ghost" id="hintB" type="button">Show a hint</button></p><div class="note" id="hintT" hidden></div>' : ''}
        ${task.lang === 'sql' && task.schema ? `<h3>Tables</h3><pre><code>${esc(task.schema)}</code></pre>` : ''}
        ${task.tests.slice(0, task.shown ?? 2).filter(t => task.lang !== 'sql').map((t, i) => `<h3>Example ${i + 1}</h3><pre><code>${t.i.trim() ? `If the input is:\n${esc(clean(t.i))}\n\n` : ''}Your program must print:\n${esc(clean(t.o))}</code></pre>`).join('')}
        ${task.lang === 'sql' ? task.tests.slice(0, 1).map(t => `<h3>Expected result</h3><pre><code>${esc(clean(t.o)) || '(no rows)'}</code></pre>`).join('') : ''}</div></div>
      <div class="pane code"><div id="ed"></div><div class="keys" id="keys">${KEYS.common.map(k => `<button type="button" tabindex="-1" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div></div>
      <div class="pane res" id="res"><p class="muted">Run shows what your code prints. Check runs every test.</p></div>
    </div>
    <div class="ws-act"><button class="linkb" id="reset" type="button">Reset</button><span class="st" id="st"></span><button class="btn ghost" id="run" title="Ctrl+Enter">Run</button><button class="btn" id="chk" title="Ctrl+Shift+Enter">Check</button></div>
  </div>`;
  const ws = $('#ws'), res = $('#res'), st = $('#st');
  const READ = { python: '`input()` reads one line. `.split()` cuts a line into pieces.', js: '`input()` reads one line. `.split(" ")` cuts a line into pieces.', cpp: '`cin >> x` reads the next value, even across lines.', c: '`scanf("%d", &x)` reads the next value, even across lines.' };
  const showHint = () => { const h = $('#hintT'); if (h) h.innerHTML = md(task.hint + (task.langs ? '\n\n' + READ[lang] : '')); };
  if ($('#hintB')) $('#hintB').onclick = () => { $('#hintT').hidden = false; $('#hintB').hidden = true; showHint(); };
  const show = p => { ws.querySelectorAll('.ws-tabs button').forEach(b => b.classList.toggle('on', b.dataset.p === p)); ws.querySelectorAll('.pane').forEach(x => x.classList.toggle('show', x.classList.contains(p))); if (p === 'code') view?.requestMeasure(); };
  ws.querySelectorAll('.ws-tabs button').forEach(b => b.onclick = () => show(b.dataset.p));
  let view = null, saveT = null, code = load(lang), inputs = task.tests[0]?.i || '';
  const onChange = s => { code = s; clearTimeout(saveT); saveT = setTimeout(() => save(lang, code), 700); };
  const mount = async () => { view?.destroy(); $('#ed').innerHTML = ''; view = await makeEditor($('#ed'), lang, code, onChange); };
  await mount();
  $('#lang')?.addEventListener('change', async e => { save(lang, code); lang = e.target.value; store.set('lang:' + task.track.id, lang); code = load(lang); await mount(); showHint(); });
  $('#keys').addEventListener('pointerdown', e => e.preventDefault());
  $('#keys').addEventListener('click', e => {
    const k = e.target.dataset?.k; if (!k) return;
    const ins = k === '⇥' ? '    ' : k;
    view.dispatch(view.state.replaceSelection(ins)); view.focus();
  });
  const busy = b => { $('#run').disabled = $('#chk').disabled = b; if (!b) st.textContent = ''; };
  const status = s => { st.textContent = s; };
  const flush = () => { clearTimeout(saveT); save(lang, code); };
  $('#run').onclick = async () => {
    flush(); inputs = $('#stdin')?.value ?? inputs; busy(true); show('res');
    const isSql = task.lang === 'sql';
    res.innerHTML = '<p class="muted">Running…</p>';
    const r = await run({ lang, code: fullCode(task, lang, code), stdin: task.tests[0]?.i || '', status, ...(isSql ? { check: task.check } : {}), ...(isSql ? {} : { stdin: inputs }) });
    res.innerHTML = `${isSql ? '' : `<h3 style="margin-top:0">Input</h3><textarea id="stdin" rows="3" aria-label="Input for your program">${esc(inputs)}</textarea>`}
      ${r.err ? `<h3>Error</h3><pre class="bad">${esc(r.err)}</pre>` : ''}${r.compile ? '' : `<h3>Output</h3><pre>${esc(clean(r.out)) || '(nothing printed)'}</pre>`}`;
    busy(false);
  };
  $('#chk').onclick = async () => {
    flush(); busy(true); show('res');
    res.innerHTML = '<p class="muted">Checking…</p>';
    const rs = await check(task, lang, code, { status });
    const meter = `<div class="meter">${task.tests.map((_, i) => `<i class="${rs[i] ? (rs[i].pass ? 'p' : 'f') : ''}"></i>`).join('')}</div>`;
    const lastR = rs[rs.length - 1];
    if (lastR && !lastR.pass) { fails++; res.innerHTML = meter + failBox(task, lastR); }
    else {
      markSolved(task, lang, { review, fails });
      store.set('sol:' + id, { t: Date.now(), lang });
      if (review) store.del('rev-draft:' + id + ':' + lang);
      const nx = nextTask(task);
      res.innerHTML = `<div class="verdict"><svg class="tick" viewBox="0 0 44 44" aria-hidden="true"><path d="M6 24l11 12L38 8"/></svg>All ${task.tests.length} tests passed</div>${meter}<p>${nx ? `<a class="btn" href="#/do/${nx.id}">Next task</a> ` : ''}<a class="btn ghost" href="${back}">Back</a></p>`;
    }
    busy(false);
  };
  $('#reset').onclick = () => { if (confirm('Replace your code with the starting code?')) { const fresh = startCode(lang); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: fresh } }); } };
  const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('#run').disabled) { e.preventDefault(); e.stopPropagation(); (e.shiftKey ? $('#chk') : $('#run')).click(); } };
  addEventListener('keydown', onKey, true);
  if (innerWidth < 900 && !review && store.get(`draft:${id}:${lang}`)) show('code');
  const vv = window.visualViewport;
  const onvv = () => ws.style.setProperty('--kb', Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px');
  vv?.addEventListener('resize', onvv);
  cleanup = () => { flush(); view?.destroy(); vv?.removeEventListener('resize', onvv); removeEventListener('keydown', onKey, true); };
}
function viewLab(task) {
  const back = backOf(task), nx = nextTask(task);
  main.innerHTML = `<div class="ws"><div class="ws-top"><a class="back" href="${back}">‹ Back</a><span class="ti">${esc(task.title)}</span><span class="tag">Lab</span></div>
    <div class="predict"><div class="prose">${beginner() ? '<p class="note">Do this on your own machine, then mark it done. Nothing here can check it, so only mark it when it really works.</p>' : ''}${md(task.body)}
    ${theoryBox(task)}
    <p><button class="btn ghost" id="hintB" type="button">Show a hint</button></p><div class="note" id="hintT" hidden>${md(task.hint)}</div>
    <label for="notes"><h3>Your notes</h3></label><textarea class="answer" id="notes" rows="5" spellcheck="false" placeholder="Commands that worked, errors you hit">${esc(store.get('notes:' + task.id, ''))}</textarea>
    <p id="labAct"></p></div></div></div>`;
  const notes = $('#notes'), act = $('#labAct');
  const save = () => { if (notes.value !== store.get('notes:' + task.id, '')) store.set('notes:' + task.id, notes.value); };
  notes.addEventListener('blur', save); cleanup = save;
  $('#hintB').onclick = () => { $('#hintT').hidden = false; $('#hintB').hidden = true; };
  const draw = () => {
    act.innerHTML = isDone(task.id)
      ? `<span class="verdict"><svg class="tick" viewBox="0 0 44 44" aria-hidden="true"><path d="M6 24l11 12L38 8"/></svg>Lab done</span><br><br>${nx ? `<a class="btn" href="#/do/${nx.id}">Next lab</a> ` : ''}<button class="btn ghost" id="undo">Mark as not done</button>`
      : '<button class="btn" id="fin">Mark as done</button>';
    $('#fin')?.addEventListener('click', () => { save(); markSolved(task, 'lab', {}); store.set('sol:' + task.id, { t: Date.now(), lang: 'lab' }); draw(); });
    $('#undo')?.addEventListener('click', () => { store.del('done:' + task.id); store.del('sol:' + task.id); draw(); });
  };
  draw();
}
function viewPredict(task) {
  const back = backOf(task);
  main.innerHTML = `<div class="ws"><div class="ws-top"><a class="back" href="${back}">‹ Back</a><span class="ti">${esc(task.title)}</span><span class="tag">${LANGS[task.lang].name}</span></div>
    <div class="predict"><div class="prose"><p>${inline(task.body || 'Read the code. Work out exactly what it prints, without running it.')}</p><pre><code>${esc(task.code)}</code></pre>
    ${task.input ? `<h3>Input</h3><pre><code>${esc(clean(task.input))}</code></pre>` : ''}
    <label for="ans"><h3>Output</h3></label><textarea class="answer" id="ans" rows="${Math.max(3, task.lines + 1)}" autocapitalize="off" autocomplete="off" spellcheck="false">${esc(store.get('draft:' + task.id, ''))}</textarea>
    <p><button class="btn" id="chk">Check</button></p><div id="res" class="res"></div>${theoryBox(task)}</div></div></div>`;
  const a = $('#ans');
  $('#chk').onclick = () => {
    store.set('draft:' + task.id, a.value);
    if (same(a.value, task.answer)) {
      if (!isDone(task.id)) markSolved(task, task.lang, {});
      store.set('sol:' + task.id, { t: Date.now(), lang: task.lang });
      const nx = nextTask(task);
      $('#res').innerHTML = `<div class="verdict"><svg class="tick" viewBox="0 0 44 44"><path d="M6 24l11 12L38 8"/></svg>Correct</div><p>${nx ? `<a class="btn" href="#/do/${nx.id}">Next task</a> ` : ''}<a class="btn ghost" href="${back}">Back</a></p>`;
    } else $('#res').innerHTML = '<div class="verdict no">Not what it prints</div><p class="muted">Check every line, every space, and the order. Trace it again on paper.</p>';
  };
}

// ---------- you ----------
function viewSettings() {
  setTab('settings');
  const all = order.length, done = order.filter(t => isDone(t.id)).length, days = store.keys('day:').length;
  const theme = store.get('theme', 'auto');
  main.innerHTML = `<div class="page"><h1>You</h1>
    <div class="sheet stats"><div><h2>${done}</h2><span class="muted">of ${all} tasks solved</span></div><div><h2>${streak()}</h2><span class="muted">day streak</span></div><div><h2>${days}</h2><span class="muted">days practised</span></div><div><h2>${dueReviews().length}</h2><span class="muted">reviews due</span></div></div>
    <div class="sheet">
      <div class="opt"><span>Look</span><select id="theme">${[['auto', 'Follow device'], ['light', 'Exercise book'], ['dark', 'Blackboard']].map(([v, n]) => `<option value="${v}" ${v === theme ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="opt"><span>Code size</span><select id="fs">${[13, 14, 15, 16, 18].map(n => `<option ${n === store.get('fs', 15) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="opt"><span id="ofl">Use without internet<br><span class="muted" id="oflS">Downloads Python, SQL and the C/C++ compiler (about 40 MB).</span></span><button class="btn ghost" id="dl">Download</button></div>
    </div>
    <div class="sheet"><div class="opt"><span>My notes<br><span class="muted">${store.keys('notes:').filter(k => store.get(k)).length} saved from labs</span></span><a class="btn ghost" href="#/notes">Open</a></div></div>
    <div class="sheet"><div class="opt"><span>Synced<br><span class="muted" id="sy">${store.lastSync() ? new Date(store.lastSync()).toLocaleString('en-GB') : 'Not yet'}</span></span><button class="btn ghost" id="syn">Sync now</button></div>
    <div class="opt"><span>This device</span><button class="btn ghost" id="out">Sign out</button></div></div>
  </div>`;
  $('#theme').onchange = e => { store.set('theme', e.target.value); applyPrefs(); };
  $('#fs').onchange = e => { store.set('fs', +e.target.value); applyPrefs(); };
  $('#syn').onclick = async () => { try { await store.sync(); $('#sy').textContent = 'Just now'; } catch (e) { $('#sy').textContent = e.message; } };
  $('#out').onclick = async () => { try { await store.sync(); await store.api('/api/logout', { method: 'POST' }); } catch {} store.wipeLocal(); localStorage.removeItem('cb_in'); location.hash = '#/'; location.reload(); };
  $('#dl').onclick = async () => {
    const b = $('#dl'), s = $('#oflS'); b.disabled = true;
    try {
      s.textContent = 'Downloading the compiler…'; await compilerReady(p => { s.textContent = `Compiler: ${Math.min(100, Math.round(p * 100))}%`; });
      await fetch('/rt/cc/llvm-resources.tar.gz.bin'); for (const f of ['bundle.js', 'llvm.core2.wasm', 'llvm.core3.wasm', 'llvm.core4.wasm']) await fetch('/rt/cc/' + f);
      s.textContent = 'Python…'; await run({ lang: 'python', code: 'pass' });
      s.textContent = 'SQL…'; await run({ lang: 'sql', code: 'select 1' });
      s.textContent = 'Ready. Every language works offline.';
    } catch (e) { s.textContent = e.message; }
    b.disabled = false;
  };
  isCached('cpp').then(ok => { if (ok) $('#oflS') && ($('#oflS').textContent = 'Compiler downloaded.'); });
}
function viewNotes() {
  setTab('settings');
  const notes = order.filter(t => (store.get('notes:' + t.id) || '').trim());
  main.innerHTML = `<div class="page"><a href="#/settings" class="muted">You</a><h1>My notes</h1>
    ${notes.length ? notes.map(t => `<div class="sheet"><h2><a href="#/do/${t.id}">${esc(t.title)}</a></h2><p class="muted" style="margin:4px 0 8px">${esc(t.mod.title)}</p><div class="notetext">${esc(store.get('notes:' + t.id))}</div></div>`).join('') : '<div class="sheet"><p class="muted" style="margin:0">Notes you write in a lab appear here, so they become your own cheat sheet.</p></div>'}</div>`;
}
function applyPrefs() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  document.documentElement.style.setProperty('--fs', store.get('fs', 15) + 'px');
}
function viewLogin() {
  document.body.classList.add('work');
  main.innerHTML = `<form class="login"><h1>Codebit</h1><input type="password" id="p" placeholder="Passphrase" aria-label="Passphrase" autofocus autocomplete="current-password"><div class="err" id="e"></div><button class="btn">Sign in</button></form>`;
  $('form').onsubmit = async e => {
    e.preventDefault();
    try { await store.api('/api/login', { method: 'POST', body: JSON.stringify({ pass: $('#p').value }) }); localStorage.setItem('cb_in', '1'); document.body.classList.remove('work'); store.sync().catch(() => {}); route(); }
    catch (x) { $('#e').textContent = x.message; }
  };
}

// ---------- router ----------
const go = h => { location.hash = h; };
function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  if (!localStorage.getItem('cb_in')) return viewLogin();
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const q = new URLSearchParams(qs), p = path.split('/').filter(Boolean);
  if (p[0] !== 'do') lastList = location.hash || '#/';
  if (!p.length) viewToday();
  else if (p[0] === 'map') viewMap();
  else if (p[0] === 't') viewTrack(p[1]);
  else if (p[0] === 'm') viewModule(p[1], p[2]);
  else if (p[0] === 'do') viewTask(p[1], q);
  else if (p[0] === 'settings') viewSettings();
  else if (p[0] === 'notes') viewNotes();
  else viewToday();
}
async function boot() {
  applyPrefs();
  C = await (await fetch('/course.json')).json();
  for (const t of C.tracks) for (const m of t.modules) for (const x of m.tasks) {
    x.track = t; x.mod = m; if (t.langs) x.langs = t.langs; byId.set(x.id, x); order.push(x);
  }
  addEventListener('hashchange', route);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(() => {});
  store.onChange(k => { if (k === '*' && !document.body.classList.contains('work')) route(); });
  if (localStorage.getItem('cb_in')) store.sync().catch(e => { if (e instanceof store.AuthError) { localStorage.removeItem('cb_in'); route(); } });
  addEventListener('pagehide', () => store.sync({ beacon: true }).catch(() => {}));
  route();
}
boot();
