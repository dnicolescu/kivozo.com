// Crossword Helper
// - Pick a word length with a slider (2–15)
// - Pin letters at known positions, leave others blank
// - Get every dictionary word (~380k merged English list) that matches.

const DICT_URL = '../dictionary/data/words.txt';

const MIN_LEN = 2;
const MAX_LEN = 15;
const RENDER_CAP = 1000;

const els = {
  stats:       document.getElementById('stats'),
  length:      document.getElementById('length'),
  lengthVal:   document.getElementById('length-val'),
  lenDown:     document.getElementById('len-down'),
  lenUp:       document.getElementById('len-up'),
  pins:        document.getElementById('pins'),
  resetPins:   document.getElementById('reset-pins'),
  count:       document.getElementById('count'),
  countDetail: document.getElementById('count-detail'),
  rows:        document.getElementById('rows'),
  empty:       document.getElementById('empty'),
};

const state = {
  /** @type {Map<number, string[]>} length -> words */
  byLen: new Map(),
  totalWords: 0,
  /** @type {number} */
  len: 5,
  /** @type {string[]} per-position letter or '' */
  pins: [],
};

// ---------- Data ----------

async function loadData() {
  const t0 = performance.now();
  els.stats.textContent = 'loading…';
  const text = await fetch(DICT_URL).then(r => r.text());
  const words = text.split(/\r?\n/);
  let total = 0;
  for (const w of words) {
    if (!/^[a-z]+$/.test(w)) continue;
    const L = w.length;
    if (L < MIN_LEN || L > MAX_LEN) continue;
    let bucket = state.byLen.get(L);
    if (!bucket) { bucket = []; state.byLen.set(L, bucket); }
    bucket.push(w);
    total++;
  }
  state.totalWords = total;
  const ms = (performance.now() - t0).toFixed(0);
  els.stats.textContent = `${total.toLocaleString()} words · ${ms}ms`;
}

// ---------- Length slider ----------

function setLength(n) {
  const L = Math.max(MIN_LEN, Math.min(MAX_LEN, n|0));
  if (L === state.len && state.pins.length === L) return;
  state.len = L;
  // Resize pin array, keeping any letters that still fit.
  const next = new Array(L).fill('');
  for (let i = 0; i < Math.min(L, state.pins.length); i++) next[i] = state.pins[i] || '';
  state.pins = next;
  els.length.value = String(L);
  els.lengthVal.textContent = String(L);
  buildPins();
  compute();
}

// ---------- Pins ----------

function buildPins() {
  els.pins.innerHTML = '';
  for (let i = 0; i < state.len; i++) {
    const cell = document.createElement('div');
    cell.className = 'pin-cell';

    const input = document.createElement('input');
    input.className = 'pin';
    input.type = 'text';
    input.maxLength = 1;
    input.inputMode = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.i = String(i);
    input.setAttribute('aria-label', `Letter at position ${i+1}`);
    input.value = state.pins[i] || '';
    if (state.pins[i]) input.classList.add('filled');

    input.addEventListener('input', (e) => {
      const v = (e.target.value || '').toLowerCase().replace(/[^a-z]/g, '').slice(-1);
      e.target.value = v;
      state.pins[i] = v;
      e.target.classList.toggle('filled', !!v);
      if (v && i < state.len - 1) {
        const next = els.pins.querySelector(`.pin[data-i="${i+1}"]`);
        if (next) next.focus();
      }
      compute();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !state.pins[i] && i > 0) {
        e.preventDefault();
        const prev = els.pins.querySelector(`.pin[data-i="${i-1}"]`);
        if (prev) prev.focus();
      } else if (e.key === 'ArrowLeft' && i > 0) {
        e.preventDefault();
        const prev = els.pins.querySelector(`.pin[data-i="${i-1}"]`);
        if (prev) prev.focus();
      } else if (e.key === 'ArrowRight' && i < state.len - 1) {
        e.preventDefault();
        const next = els.pins.querySelector(`.pin[data-i="${i+1}"]`);
        if (next) next.focus();
      }
    });

    cell.appendChild(input);
    els.pins.appendChild(cell);
  }
}

function resetPins() {
  state.pins = new Array(state.len).fill('');
  for (const inp of els.pins.querySelectorAll('.pin')) {
    inp.value = '';
    inp.classList.remove('filled');
  }
  compute();
  const first = els.pins.querySelector('.pin');
  if (first) first.focus();
}

// ---------- Match ----------

function compute() {
  const t0 = performance.now();
  const bucket = state.byLen.get(state.len) || [];
  const pins = state.pins;
  // Build a fixed-length array of letters or null for quick checking.
  const pat = new Array(state.len);
  let hasAny = false;
  for (let i = 0; i < state.len; i++) {
    const c = pins[i] || '';
    pat[i] = c || null;
    if (c) hasAny = true;
  }

  let results;
  if (!hasAny) {
    results = bucket;
  } else {
    results = [];
    for (const w of bucket) {
      let ok = true;
      for (let i = 0; i < state.len; i++) {
        if (pat[i] !== null && w.charCodeAt(i) !== pat[i].charCodeAt(0)) { ok = false; break; }
      }
      if (ok) results.push(w);
    }
  }

  const ms = (performance.now() - t0).toFixed(0);
  const total = results.length;
  els.count.textContent = `${total.toLocaleString()} match${total === 1 ? '' : 'es'}`;
  els.countDetail.textContent = total > RENDER_CAP
    ? `· showing first ${RENDER_CAP.toLocaleString()} · ${ms}ms`
    : `· ${ms}ms`;
  render(results.slice(0, RENDER_CAP), pat);
}

function render(words, pat) {
  els.rows.innerHTML = '';
  els.empty.classList.toggle('hidden', words.length > 0);
  if (!words.length) return;
  const frag = document.createDocumentFragment();
  for (const w of words) {
    const cell = document.createElement('div');
    cell.className = 'word';
    let html = '';
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      html += pat[i] ? `<b>${ch}</b>` : ch;
    }
    cell.innerHTML = html;
    frag.appendChild(cell);
  }
  els.rows.appendChild(frag);
}

// ---------- Wiring ----------

function init() {
  els.length.min = String(MIN_LEN);
  els.length.max = String(MAX_LEN);
  els.length.addEventListener('input', () => setLength(+els.length.value));
  els.lenDown.addEventListener('click', () => setLength(state.len - 1));
  els.lenUp.addEventListener('click', () => setLength(state.len + 1));
  els.resetPins.addEventListener('click', resetPins);

  // Global keyboard niceties: typing a letter when nothing is focused targets
  // the first empty pin.
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'BUTTON' || ae.tagName === 'TEXTAREA')) return;
    if (/^[a-zA-Z]$/.test(e.key)) {
      const idx = state.pins.findIndex(p => !p);
      const target = idx >= 0 ? idx : 0;
      const inp = els.pins.querySelector(`.pin[data-i="${target}"]`);
      if (inp) inp.focus();
    }
  });

  setLength(5);
}

(async () => {
  init();
  await loadData();
  compute();
})();
