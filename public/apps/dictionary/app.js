// Word Explorer — static dictionary browser
// Loads engmix wordlist once, builds prefix + suffix indexes in-memory,
// filters by query + per-letter required/forbidden constraints.

const DATA_URL = './data/words.txt';

const els = {
  stats: document.getElementById('stats'),
  query: document.getElementById('query'),
  clearQuery: document.getElementById('clear-query'),
  letters: document.getElementById('letters'),
  clearLetters: document.getElementById('clear-letters'),
  activeFilters: document.getElementById('active-filters'),
  count: document.getElementById('count'),
  sortLabel: document.getElementById('sort-label'),
  viewport: document.getElementById('viewport'),
  spacer: document.getElementById('spacer'),
  rows: document.getElementById('rows'),
  modePrefix: document.getElementById('mode-prefix'),
  modeSuffix: document.getElementById('mode-suffix'),
};

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const ROW_H = 32; // px, must match .row height in CSS

// State
const state = {
  /** @type {string[]} originals sorted A→Z */
  asc: [],
  /** @type {string[]} reversed strings sorted A→Z (so suffix lookup is a prefix lookup) */
  rev: [],
  mode: /** @type {'prefix'|'suffix'} */ ('prefix'),
  query: '',
  /** @type {Map<string, 'req'|'forb'>} per-letter state */
  letterState: new Map(),
  /** @type {string[]} current filtered results (always shown as ORIGINAL words) */
  results: [],
};

// ---------- Load ----------

async function load() {
  const t0 = performance.now();
  els.stats.textContent = 'loading…';
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch dictionary (${res.status})`);
  const text = await res.text();
  const words = text.split(/\r?\n/).filter(Boolean);
  // engmix is already sorted ASCII A→Z; trust it.
  state.asc = words;
  // For suffix mode: store the reversed strings, sorted A→Z.
  // Then suffix search becomes a prefix search of the reversed query.
  const rev = new Array(words.length);
  for (let i = 0; i < words.length; i++) rev[i] = reverseStr(words[i]);
  rev.sort();
  state.rev = rev;

  const ms = (performance.now() - t0).toFixed(0);
  els.stats.textContent = `${words.length.toLocaleString()} words · loaded in ${ms}ms`;
}

function reverseStr(s) {
  // Simple ASCII reverse (word list is ASCII letters).
  let out = '';
  for (let i = s.length - 1; i >= 0; i--) out += s[i];
  return out;
}

// ---------- Binary search helpers ----------

/** Lower bound of `prefix` in sorted array `arr`. */
function lowerBound(arr, prefix) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < prefix) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Upper bound: first index whose value does NOT start with `prefix`
 *  (computed as lowerBound of prefix-with-last-char-incremented). */
function upperBoundOfPrefix(arr, prefix) {
  // Build "next" string after all words starting with `prefix`.
  if (!prefix) return arr.length;
  const last = prefix.charCodeAt(prefix.length - 1);
  if (last >= 0x7e) {
    // unreachable for a-z, but be safe — fall back to linear scan from lower bound.
    let lo = lowerBound(arr, prefix);
    while (lo < arr.length && arr[lo].startsWith(prefix)) lo++;
    return lo;
  }
  const next = prefix.slice(0, -1) + String.fromCharCode(last + 1);
  return lowerBound(arr, next);
}

// ---------- Filtering ----------

function compute() {
  const isSuffix = state.mode === 'suffix';
  const arr = isSuffix ? state.rev : state.asc;
  const rawQ = state.query.trim().toLowerCase();
  const q = rawQ.replace(/[^a-z]/g, '');
  // In suffix mode, the index is keyed by reversed strings, so reverse the query
  // and do an ordinary prefix lookup.
  const key = isSuffix ? reverseStr(q) : q;

  let from = 0, to = arr.length;
  if (key) {
    from = lowerBound(arr, key);
    to = upperBoundOfPrefix(arr, key);
  }

  // Letter constraints
  const required = [];
  const forbidden = new Set();
  for (const [ltr, st] of state.letterState) {
    if (st === 'req') required.push(ltr);
    else if (st === 'forb') forbidden.add(ltr);
  }

  const out = [];
  outer: for (let i = from; i < to; i++) {
    // arr[i] is reversed in suffix mode — but letter membership is the same in either direction,
    // so we can apply letter filters before un-reversing for cheaper output.
    const w = arr[i];
    if (forbidden.size) {
      for (let k = 0; k < w.length; k++) if (forbidden.has(w[k])) continue outer;
    }
    if (required.length) {
      for (let r = 0; r < required.length; r++) if (w.indexOf(required[r]) === -1) continue outer;
    }
    out.push(isSuffix ? reverseStr(w) : w);
  }

  state.results = out;
  render();
}

// ---------- Render ----------

function render() {
  renderActiveFilters();

  const n = state.results.length;
  els.count.textContent = n === 0
    ? 'no matches'
    : `${n.toLocaleString()} ${n === 1 ? 'word' : 'words'}`;
  els.sortLabel.textContent = state.mode === 'prefix' ? 'sorted A → Z' : 'sorted by ending';

  // Virtualized list
  els.spacer.style.height = (n * ROW_H) + 'px';
  if (n === 0) {
    els.rows.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'row empty';
    empty.textContent = state.query || state.letterState.size
      ? 'No words match these filters.'
      : 'Type to search, or click letters below.';
    els.rows.appendChild(empty);
    return;
  }

  renderWindow();
}

function renderWindow() {
  const n = state.results.length;
  const vh = els.viewport.clientHeight || 400;
  const scrollTop = els.viewport.scrollTop;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const visible = Math.ceil(vh / ROW_H) + 12;
  const end = Math.min(n, start + visible);

  els.rows.style.transform = `translateY(${start * ROW_H}px)`;

  const frag = document.createDocumentFragment();
  const q = state.query.trim().toLowerCase().replace(/[^a-z]/g, '');
  for (let i = start; i < end; i++) {
    const w = state.results[i];
    const row = document.createElement('div');
    row.className = 'row';

    const word = document.createElement('span');
    word.className = 'word';
    if (q && state.mode === 'prefix' && w.startsWith(q)) {
      word.innerHTML = `<span class="hit">${escapeHTML(w.slice(0, q.length))}</span>${escapeHTML(w.slice(q.length))}`;
    } else if (q && state.mode === 'suffix' && w.endsWith(q)) {
      word.innerHTML = `${escapeHTML(w.slice(0, w.length - q.length))}<span class="hit">${escapeHTML(w.slice(w.length - q.length))}</span>`;
    } else {
      word.textContent = w;
    }

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${w.length}`;

    row.appendChild(word);
    row.appendChild(meta);
    frag.appendChild(row);
  }
  els.rows.replaceChildren(frag);
}

function renderActiveFilters() {
  const parts = [];
  if (state.query) {
    parts.push(`<span class="chip">${state.mode === 'prefix' ? 'starts' : 'ends'} with “${escapeHTML(state.query)}”</span>`);
  }
  for (const [ltr, st] of state.letterState) {
    parts.push(`<span class="chip ${st}">${ltr}</span>`);
  }
  els.activeFilters.innerHTML = parts.join(' ');
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Letter map ----------

function buildLetterMap() {
  const frag = document.createDocumentFragment();
  for (const c of ALPHA) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ltr';
    b.dataset.letter = c;
    b.textContent = c;
    b.title = `${c} — click to require, click again to forbid, again to clear`;
    b.addEventListener('click', () => cycleLetter(c, b));
    frag.appendChild(b);
  }
  els.letters.appendChild(frag);
}

function cycleLetter(c, btn) {
  const cur = state.letterState.get(c);
  let next;
  if (!cur) next = 'req';
  else if (cur === 'req') next = 'forb';
  else next = null;

  btn.classList.remove('req', 'forb');
  if (next) {
    state.letterState.set(c, next);
    btn.classList.add(next);
  } else {
    state.letterState.delete(c);
  }
  scheduleCompute();
}

function resetLetters() {
  state.letterState.clear();
  for (const b of els.letters.querySelectorAll('.ltr')) {
    b.classList.remove('req', 'forb');
  }
  scheduleCompute();
}

// ---------- Mode ----------

function setMode(m) {
  if (state.mode === m) return;
  state.mode = m;
  els.modePrefix.classList.toggle('active', m === 'prefix');
  els.modeSuffix.classList.toggle('active', m === 'suffix');
  els.modePrefix.setAttribute('aria-selected', String(m === 'prefix'));
  els.modeSuffix.setAttribute('aria-selected', String(m === 'suffix'));
  els.query.placeholder = m === 'prefix' ? 'starts with…' : 'ends with…';
  els.viewport.scrollTop = 0;
  scheduleCompute();
}

// ---------- Debounce / wiring ----------

let computeTimer = null;
function scheduleCompute() {
  if (computeTimer) clearTimeout(computeTimer);
  computeTimer = setTimeout(() => { computeTimer = null; compute(); }, 60);
}

function wire() {
  els.query.addEventListener('input', () => {
    state.query = els.query.value;
    els.viewport.scrollTop = 0;
    scheduleCompute();
  });
  els.clearQuery.addEventListener('click', () => {
    els.query.value = '';
    state.query = '';
    els.query.focus();
    els.viewport.scrollTop = 0;
    scheduleCompute();
  });
  els.clearLetters.addEventListener('click', resetLetters);
  els.modePrefix.addEventListener('click', () => setMode('prefix'));
  els.modeSuffix.addEventListener('click', () => setMode('suffix'));
  els.viewport.addEventListener('scroll', () => {
    if (state.results.length > 0) renderWindow();
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (state.results.length > 0) renderWindow();
  });
}

// ---------- Boot ----------

(async function main() {
  buildLetterMap();
  wire();
  try {
    await load();
    compute();
  } catch (e) {
    els.stats.textContent = 'failed to load dictionary';
    els.count.textContent = String(e?.message ?? e);
    console.error(e);
  }
})();
