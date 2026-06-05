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
  minLen: document.getElementById('min-len'),
  maxLen: document.getElementById('max-len'),
  minLenVal: document.getElementById('min-len-val'),
  maxLenVal: document.getElementById('max-len-val'),
  clearLength: document.getElementById('clear-length'),
  rangeDual: document.getElementById('range-dual'),
  rangeFill: document.getElementById('range-fill'),
  minBubble: document.getElementById('min-bubble'),
  maxBubble: document.getElementById('max-bubble'),
  sortButtons: Array.from(document.querySelectorAll('.sort-btn')),
  sidebar: document.getElementById('sidebar-index'),
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
  /** @type {number} inclusive */
  minLen: 1,
  /** @type {number} inclusive */
  maxLen: 30,
  /** @type {number} highest word length present in the dictionary (set on load) */
  maxLenCap: 30,
  /** @type {'az'|'za'} display sort order */
  sort: 'az',
  /** @type {string[]} current filtered results (always shown as ORIGINAL words) */
  results: [],
  /** @type {Int32Array} per-letter (a..z) starting index into results; -1 if absent */
  firstLetterIdx: new Int32Array(26),
  /** @type {string|null} which sidebar letter is currently in view */
  activeLetter: null,
};

// ---------- Load ----------

async function load() {
  const t0 = performance.now();
  els.stats.textContent = 'loading…';
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch dictionary (${res.status})`);
  const text = await res.text();
  const rawCount = (text.match(/\n/g) || []).length + 1;
  // Keep only lowercase a–z words. The shipped engmix list includes a handful of
  // accented entries (e.g. "époque", "émigrés") which render as boxes in many
  // fonts and break sort/binary-search assumptions; drop them.
  const words = text.split(/\r?\n/).filter((w) => w && /^[a-z]+$/.test(w));
  // engmix is already sorted ASCII A→Z; trust it.
  state.asc = words;
  // For suffix mode: store the reversed strings, sorted A→Z.
  // Then suffix search becomes a prefix search of the reversed query.
  const rev = new Array(words.length);
  let maxLen = 1;
  for (let i = 0; i < words.length; i++) {
    rev[i] = reverseStr(words[i]);
    if (words[i].length > maxLen) maxLen = words[i].length;
  }
  rev.sort();
  state.rev = rev;

  // Tighten the length sliders to the actual range present in the dictionary.
  state.maxLenCap = maxLen;
  state.maxLen = maxLen;
  els.minLen.max = String(maxLen);
  els.maxLen.max = String(maxLen);
  els.maxLen.value = String(maxLen);
  els.maxLenVal.textContent = String(maxLen);
  updateRangeVisuals();

  const ms = (performance.now() - t0).toFixed(0);
  const droppedNote = rawCount - words.length > 0 ? ` (filtered ${rawCount - words.length} non-ASCII)` : '';
  els.stats.textContent = `${words.length.toLocaleString()} words · loaded in ${ms}ms${droppedNote}`;
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

  // Letter & length constraints
  const required = [];
  const forbidden = new Set();
  for (const [ltr, st] of state.letterState) {
    if (st === 'req') required.push(ltr);
    else if (st === 'forb') forbidden.add(ltr);
  }
  const minLen = state.minLen;
  const maxLen = state.maxLen;

  const out = [];
  outer: for (let i = from; i < to; i++) {
    // arr[i] is reversed in suffix mode — but letter membership and length are the same
    // in either direction, so we can filter before un-reversing.
    const w = arr[i];
    const L = w.length;
    if (L < minLen || L > maxLen) continue;
    if (forbidden.size) {
      for (let k = 0; k < L; k++) if (forbidden.has(w[k])) continue outer;
    }
    if (required.length) {
      for (let r = 0; r < required.length; r++) if (w.indexOf(required[r]) === -1) continue outer;
    }
    out.push(isSuffix ? reverseStr(w) : w);
  }

  // Sort for display. In prefix mode the slice is already A→Z; in suffix mode
  // it comes back roughly grouped by ending, so we always sort explicitly.
  sortResults(out, state.sort);

  state.results = out;
  buildFirstLetterIndex();
  render();
}

function sortResults(arr, sort) {
  if (sort === 'az') {
    arr.sort();
  } else {
    // 'za' — descending lexicographic
    arr.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }
}

function buildFirstLetterIndex() {
  // For each letter a..z, store the first index in `state.results` whose first
  // letter is >= that letter (when ascending) or <= (when descending).
  // Empty letters get -1.
  const idx = state.firstLetterIdx;
  idx.fill(-1);
  const n = state.results.length;
  if (n === 0) return;
  if (state.sort === 'az') {
    let cursor = 0;
    for (let li = 0; li < 26; li++) {
      const ch = String.fromCharCode(97 + li);
      while (cursor < n && state.results[cursor][0] < ch) cursor++;
      if (cursor < n && state.results[cursor][0] === ch) idx[li] = cursor;
    }
  } else {
    // descending: scan from end of alphabet down
    let cursor = 0;
    for (let li = 25; li >= 0; li--) {
      const ch = String.fromCharCode(97 + li);
      while (cursor < n && state.results[cursor][0] > ch) cursor++;
      if (cursor < n && state.results[cursor][0] === ch) idx[li] = cursor;
    }
  }
}

// ---------- Render ----------

function render() {
  renderActiveFilters();

  const n = state.results.length;
  els.count.textContent = n === 0
    ? 'no matches'
    : `${n.toLocaleString()} ${n === 1 ? 'word' : 'words'}`;
  els.sortLabel.textContent = state.sort === 'az' ? 'sorted A → Z' : 'sorted Z → A';

  // Virtualized list
  els.spacer.style.height = (n * ROW_H) + 'px';
  if (n === 0) {
    els.rows.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'row empty';
    empty.textContent = state.query || state.letterState.size || state.minLen > 1 || state.maxLen < state.maxLenCap
      ? 'No words match these filters.'
      : 'Type to search, or click letters below.';
    els.rows.appendChild(empty);
    renderSidebar();
    return;
  }

  renderSidebar();
  renderWindow();
  updateSidebarActive();
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
  if (state.minLen > 1 || state.maxLen < state.maxLenCap) {
    parts.push(`<span class="chip">length ${state.minLen}\u2013${state.maxLen}</span>`);
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

// ---------- Sort ----------

function setSort(s) {
  if (state.sort === s) return;
  state.sort = s;
  for (const b of els.sortButtons) {
    const on = b.dataset.sort === s;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  }
  els.viewport.scrollTop = 0;
  scheduleCompute();
}

// ---------- Length ----------

function onLengthInput() {
  let mn = +els.minLen.value;
  let mx = +els.maxLen.value;
  // Keep them in order: if the user drags one past the other, push the other.
  if (mn > mx) {
    // Whichever moved last wins; figure that out by comparing to state.
    if (mn !== state.minLen) { mx = mn; els.maxLen.value = String(mx); }
    else { mn = mx; els.minLen.value = String(mn); }
  }
  state.minLen = mn;
  state.maxLen = mx;
  els.minLenVal.textContent = String(mn);
  els.maxLenVal.textContent = String(mx);
  updateRangeVisuals();
  scheduleCompute();
}

function resetLength() {
  state.minLen = 1;
  state.maxLen = state.maxLenCap;
  els.minLen.value = '1';
  els.maxLen.value = String(state.maxLenCap);
  els.minLenVal.textContent = '1';
  els.maxLenVal.textContent = String(state.maxLenCap);
  updateRangeVisuals();
  scheduleCompute();
}

/** Compute the percentage position (0..100) of a slider value within its range. */
function rangePct(v) {
  const min = 1;
  const max = state.maxLenCap;
  if (max <= min) return 0;
  return ((v - min) / (max - min)) * 100;
}

/** Reposition the filled segment, the bubbles, and the input z-index so both
 *  thumbs stay reachable when they crowd one end. */
function updateRangeVisuals() {
  const pctMin = rangePct(state.minLen);
  const pctMax = rangePct(state.maxLen);
  els.rangeFill.style.left = pctMin + '%';
  els.rangeFill.style.right = (100 - pctMax) + '%';
  els.minBubble.style.left = pctMin + '%';
  els.maxBubble.style.left = pctMax + '%';
  els.minBubble.textContent = String(state.minLen);
  els.maxBubble.textContent = String(state.maxLen);
  // When the min thumb is past the midpoint, raise its z-index so it stays
  // grabbable; otherwise let the max thumb sit on top (default).
  els.minLen.style.zIndex = pctMin > 50 ? '4' : '3';
  els.maxLen.style.zIndex = pctMax < 50 ? '4' : '3';
}

// ---------- Sidebar (first-letter index) ----------

function buildSidebar() {
  const frag = document.createDocumentFragment();
  for (const c of ALPHA) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.letter = c;
    b.textContent = c;
    b.title = `jump to ${c.toUpperCase()}`;
    b.addEventListener('click', () => jumpToLetter(c));
    frag.appendChild(b);
  }
  els.sidebar.appendChild(frag);
}

function renderSidebar() {
  // Letters present in current results are clickable; absent letters are dimmed.
  // Order is always A→Z visually so muscle memory works.
  for (const b of els.sidebar.children) {
    const li = b.dataset.letter.charCodeAt(0) - 97;
    const present = state.firstLetterIdx[li] !== -1;
    b.classList.toggle('empty', !present);
    b.disabled = !present;
  }
}

function jumpToLetter(c) {
  const li = c.charCodeAt(0) - 97;
  const start = state.firstLetterIdx[li];
  if (start < 0) return;
  els.viewport.scrollTop = start * ROW_H;
}

function updateSidebarActive() {
  const n = state.results.length;
  if (n === 0) { setActiveLetter(null); return; }
  const topRow = Math.floor(els.viewport.scrollTop / ROW_H);
  const first = state.results[Math.min(topRow, n - 1)];
  if (!first) { setActiveLetter(null); return; }
  setActiveLetter(first[0]);
}

function setActiveLetter(c) {
  if (state.activeLetter === c) return;
  state.activeLetter = c;
  for (const b of els.sidebar.children) {
    b.classList.toggle('active', c !== null && b.dataset.letter === c);
  }
}

// ---------- Debounce / wiring ----------

let computeTimer = null;
function scheduleCompute() {
  if (computeTimer) clearTimeout(computeTimer);
  computeTimer = setTimeout(() => { computeTimer = null; compute(); }, 60);
}

/** Light up the corresponding bubble while the user is interacting with a slider. */
function wireBubbleHighlight(input, bubble) {
  const on = () => {
    els.rangeDual.classList.add('dragging');
    for (const b of [els.minBubble, els.maxBubble]) b.classList.remove('active');
    bubble.classList.add('active');
  };
  const off = () => {
    els.rangeDual.classList.remove('dragging');
    bubble.classList.remove('active');
  };
  input.addEventListener('pointerdown', on);
  input.addEventListener('focus', on);
  input.addEventListener('pointerup', off);
  input.addEventListener('pointercancel', off);
  input.addEventListener('blur', off);
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
  for (const b of els.sortButtons) {
    b.addEventListener('click', () => setSort(b.dataset.sort));
  }
  els.minLen.addEventListener('input', onLengthInput);
  els.maxLen.addEventListener('input', onLengthInput);
  els.clearLength.addEventListener('click', resetLength);
  wireBubbleHighlight(els.minLen, els.minBubble);
  wireBubbleHighlight(els.maxLen, els.maxBubble);
  els.viewport.addEventListener('scroll', () => {
    if (state.results.length > 0) {
      renderWindow();
      updateSidebarActive();
    }
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (state.results.length > 0) renderWindow();
  });
}

// ---------- Boot ----------

(async function main() {
  buildLetterMap();
  buildSidebar();
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
