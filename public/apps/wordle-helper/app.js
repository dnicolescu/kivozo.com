// Wordle Helper
// Two input modes (guess board / manual pins) feed a single constraint set
// that filters the 5-letter slice of the merged 380k dictionary.
// Curated "possible solution" words are highlighted and can be filtered to.

const DICT_URL = '../dictionary/data/words.txt';
const SOL_URL  = './data/solutions.txt';

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const ROWS = 6;
const COLS = 5;

// Tile color states.
//   ''     = untagged (typed but no color set; ignored by filter)
//   'abs'  = absent  (gray)
//   'pres' = present (yellow) — letter in word but not at this position
//   'cor'  = correct (green)  — letter at this exact position
const CYCLE = ['', 'abs', 'pres', 'cor'];

const els = {
  stats:           document.getElementById('stats'),
  tabGuess:        document.getElementById('tab-guess'),
  tabManual:       document.getElementById('tab-manual'),
  panelGuess:      document.getElementById('panel-guess'),
  panelManual:     document.getElementById('panel-manual'),
  board:           document.getElementById('board'),
  resetBoard:      document.getElementById('reset-board'),
  pins:            document.getElementById('pins'),
  resetPins:       document.getElementById('reset-pins'),
  letters:         document.getElementById('letters'),
  resetLetters:    document.getElementById('reset-letters'),
  optSolOnly:      document.getElementById('opt-solutions-only'),
  optSolFirst:     document.getElementById('opt-solutions-first'),
  count:           document.getElementById('count'),
  countDetail:     document.getElementById('count-detail'),
  rows:            document.getElementById('rows'),
  empty:           document.getElementById('empty'),
};

const state = {
  /** @type {string[]} 5-letter dictionary words sorted A→Z */
  dict5: [],
  /** @type {Set<string>} curated possible-solution words */
  solSet: new Set(),
  mode: /** @type {'guess'|'manual'} */ ('guess'),
  // ---- Guess mode state ----
  /** 6×5 grid of {letter, state} */
  grid: Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ letter: '', state: '' }))
  ),
  cursor: { r: 0, c: 0 },
  // ---- Manual mode state ----
  pins: ['', '', '', '', ''], // green letters per position
  letterState: new Map(),     // a-z -> 'req' | 'forb'
};

// ---------- Data ----------

async function loadData() {
  const t0 = performance.now();
  els.stats.textContent = 'loading…';
  const [dictText, solText] = await Promise.all([
    fetch(DICT_URL).then(r => r.text()),
    fetch(SOL_URL).then(r => r.text()),
  ]);
  state.dict5 = dictText.split(/\r?\n/).filter(w => /^[a-z]{5}$/.test(w));
  state.solSet = new Set(
    solText.toLowerCase().split(/[^a-z]+/).filter(w => w.length === 5)
  );
  const ms = (performance.now() - t0).toFixed(0);
  els.stats.textContent = `${state.dict5.length.toLocaleString()} words · ${state.solSet.size.toLocaleString()} solutions · ${ms}ms`;
}

// ---------- Mode tabs ----------

function setMode(m) {
  state.mode = m;
  els.tabGuess.classList.toggle('active', m === 'guess');
  els.tabGuess.setAttribute('aria-selected', String(m === 'guess'));
  els.tabManual.classList.toggle('active', m === 'manual');
  els.tabManual.setAttribute('aria-selected', String(m === 'manual'));
  els.panelGuess.classList.toggle('hidden', m !== 'guess');
  els.panelManual.classList.toggle('hidden', m !== 'manual');
  compute();
}

// ---------- Board (guess mode) ----------

function buildBoard() {
  els.board.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div');
    row.className = 'board-row';
    for (let c = 0; c < COLS; c++) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'tile empty';
      t.dataset.r = String(r);
      t.dataset.c = String(c);
      t.setAttribute('aria-label', `Row ${r+1} column ${c+1}`);
      t.addEventListener('click', (e) => onTileClick(r, c, +1, e));
      t.addEventListener('contextmenu', (e) => { e.preventDefault(); onTileClick(r, c, -1, e); });
      row.appendChild(t);
    }
    els.board.appendChild(row);
  }
  renderBoard();
}

function onTileClick(r, c, dir, _e) {
  const cell = state.grid[r][c];
  if (!cell.letter) {
    // empty tile -> set cursor here
    state.cursor = { r, c };
    renderBoard();
    return;
  }
  // cycle color
  const idx = CYCLE.indexOf(cell.state);
  const next = CYCLE[(idx + dir + CYCLE.length) % CYCLE.length];
  cell.state = next;
  renderBoard();
  compute();
}

function renderBoard() {
  const tiles = els.board.querySelectorAll('.tile');
  for (const t of tiles) {
    const r = +t.dataset.r, c = +t.dataset.c;
    const cell = state.grid[r][c];
    t.textContent = cell.letter || '';
    t.classList.toggle('empty', !cell.letter);
    t.classList.toggle('filled', !!cell.letter);
    t.classList.remove('s-abs', 's-pres', 's-cor', 'active');
    if (cell.state) t.classList.add('s-' + cell.state);
    if (r === state.cursor.r && c === state.cursor.c) t.classList.add('active');
  }
}

function typeLetter(ch) {
  const { r, c } = state.cursor;
  if (r >= ROWS) return;
  state.grid[r][c] = { letter: ch, state: '' };
  // advance cursor
  if (c < COLS - 1) state.cursor = { r, c: c + 1 };
  else if (r < ROWS - 1) state.cursor = { r: r + 1, c: 0 };
  renderBoard();
  compute();
}

function backspace() {
  const { r, c } = state.cursor;
  // If current cell has a letter, clear it. Otherwise step back and clear.
  const cur = state.grid[r] && state.grid[r][c];
  if (cur && cur.letter) {
    state.grid[r][c] = { letter: '', state: '' };
  } else if (c > 0) {
    state.cursor = { r, c: c - 1 };
    state.grid[r][c - 1] = { letter: '', state: '' };
  } else if (r > 0) {
    state.cursor = { r: r - 1, c: COLS - 1 };
    state.grid[r - 1][COLS - 1] = { letter: '', state: '' };
  }
  renderBoard();
  compute();
}

function moveCursor(dr, dc) {
  let { r, c } = state.cursor;
  r = Math.max(0, Math.min(ROWS - 1, r + dr));
  c = Math.max(0, Math.min(COLS - 1, c + dc));
  state.cursor = { r, c };
  renderBoard();
}

function resetBoard() {
  state.grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ letter: '', state: '' }))
  );
  state.cursor = { r: 0, c: 0 };
  renderBoard();
  compute();
}

// ---------- Manual mode ----------

function buildPins() {
  els.pins.innerHTML = '';
  for (let i = 0; i < COLS; i++) {
    const input = document.createElement('input');
    input.className = 'pin';
    input.type = 'text';
    input.maxLength = 1;
    input.inputMode = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.i = String(i);
    input.setAttribute('aria-label', `Pinned letter at position ${i+1}`);
    input.addEventListener('input', (e) => {
      const v = (e.target.value || '').toLowerCase().replace(/[^a-z]/g, '').slice(-1);
      state.pins[i] = v;
      e.target.value = v;
      e.target.classList.toggle('filled', !!v);
      if (v && i < COLS - 1) {
        const next = els.pins.querySelector(`.pin[data-i="${i+1}"]`);
        if (next) next.focus();
      }
      compute();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !state.pins[i] && i > 0) {
        const prev = els.pins.querySelector(`.pin[data-i="${i-1}"]`);
        if (prev) prev.focus();
      }
    });
    els.pins.appendChild(input);
  }
}

function resetPins() {
  state.pins = ['', '', '', '', ''];
  for (const inp of els.pins.querySelectorAll('.pin')) {
    inp.value = '';
    inp.classList.remove('filled');
  }
  compute();
}

function buildLetters() {
  els.letters.innerHTML = '';
  for (const c of ALPHA) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ltr';
    b.textContent = c;
    b.dataset.c = c;
    b.addEventListener('click', () => cycleLetter(c, b, +1));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); cycleLetter(c, b, -1); });
    els.letters.appendChild(b);
  }
}

function cycleLetter(c, btn, dir) {
  const cur = state.letterState.get(c);
  let next;
  if (dir === +1) {
    if (!cur) next = 'req';
    else if (cur === 'req') next = 'forb';
    else next = null;
  } else {
    if (!cur) next = 'forb';
    else if (cur === 'forb') next = 'req';
    else next = null;
  }
  btn.classList.remove('req', 'forb');
  if (next) { state.letterState.set(c, next); btn.classList.add(next); }
  else state.letterState.delete(c);
  compute();
}

function resetLetters() {
  state.letterState.clear();
  for (const b of els.letters.querySelectorAll('.ltr')) b.classList.remove('req', 'forb');
  compute();
}

// ---------- Constraint extraction ----------

/**
 * Build constraints from the active mode.
 * Returns { green, posExcl, minCount, maxCount } where:
 *   green:    string[5]   exact letter required at position i (or '')
 *   posExcl:  Set<char>[] letters known NOT to be at position i
 *   minCount: Map<char,n> minimum count of letter in answer
 *   maxCount: Map<char,n> maximum count of letter in answer (undefined = unbounded)
 */
function buildConstraints() {
  const green = ['', '', '', '', ''];
  const posExcl = [new Set(), new Set(), new Set(), new Set(), new Set()];
  const minCount = new Map();
  const maxCount = new Map();

  if (state.mode === 'guess') {
    for (let r = 0; r < ROWS; r++) {
      // Per-row letter accounting (handles repeated letters).
      const rowCount = new Map(); // letter -> {presCount, grayCount}
      for (let c = 0; c < COLS; c++) {
        const { letter, state: s } = state.grid[r][c];
        if (!letter || !s) continue;
        const entry = rowCount.get(letter) || { pres: 0, gray: 0 };
        if (s === 'cor' || s === 'pres') entry.pres++;
        else if (s === 'abs') entry.gray++;
        rowCount.set(letter, entry);

        if (s === 'cor') {
          // pin position
          if (!green[c] || green[c] === letter) green[c] = letter;
        } else if (s === 'pres') {
          // letter is in word but not at this position
          posExcl[c].add(letter);
        } else if (s === 'abs') {
          // letter not at this position (stronger global rules computed below)
          posExcl[c].add(letter);
        }
      }
      for (const [ltr, { pres, gray }] of rowCount) {
        if (pres > 0) {
          minCount.set(ltr, Math.max(minCount.get(ltr) ?? 0, pres));
        }
        if (gray > 0) {
          // exact-count signal: answer has exactly `pres` of this letter
          const cap = pres;
          const prev = maxCount.get(ltr);
          maxCount.set(ltr, prev === undefined ? cap : Math.min(prev, cap));
        }
      }
    }
  } else {
    // manual mode
    for (let i = 0; i < COLS; i++) {
      if (state.pins[i]) green[i] = state.pins[i];
    }
    for (const [ltr, s] of state.letterState) {
      if (s === 'req') minCount.set(ltr, Math.max(minCount.get(ltr) ?? 0, 1));
      else if (s === 'forb') maxCount.set(ltr, 0);
    }
  }

  return { green, posExcl, minCount, maxCount };
}

function matches(w, k) {
  // positional checks
  for (let i = 0; i < COLS; i++) {
    if (k.green[i] && w[i] !== k.green[i]) return false;
    if (k.posExcl[i].has(w[i])) return false;
  }
  // count checks
  if (k.minCount.size || k.maxCount.size) {
    const cnt = new Map();
    for (let i = 0; i < COLS; i++) cnt.set(w[i], (cnt.get(w[i]) ?? 0) + 1);
    for (const [ltr, n] of k.minCount) if ((cnt.get(ltr) ?? 0) < n) return false;
    for (const [ltr, n] of k.maxCount) if ((cnt.get(ltr) ?? 0) > n) return false;
  }
  return true;
}

// ---------- Filter + render ----------

function compute() {
  if (!state.dict5.length) return;
  const k = buildConstraints();
  const out = [];
  for (const w of state.dict5) if (matches(w, k)) out.push(w);

  // Split solutions vs others.
  const sols = [];
  const others = [];
  for (const w of out) {
    if (state.solSet.has(w)) sols.push(w);
    else others.push(w);
  }

  let display;
  if (els.optSolOnly.checked) display = sols.slice();
  else if (els.optSolFirst.checked) display = [...sols, ...others];
  else display = out.slice();

  render(display, sols.length, others.length);
}

function render(words, solCount, otherCount) {
  els.rows.innerHTML = '';
  if (!words.length) {
    els.empty.classList.remove('hidden');
    els.count.textContent = '0';
    els.countDetail.textContent = '';
    return;
  }
  els.empty.classList.add('hidden');
  els.count.textContent = words.length.toLocaleString();
  els.countDetail.textContent = els.optSolOnly.checked
    ? `solution${solCount === 1 ? '' : 's'} only`
    : `· ${solCount.toLocaleString()} solution${solCount === 1 ? '' : 's'}, ${otherCount.toLocaleString()} other word${otherCount === 1 ? '' : 's'}`;

  // Cap rendered list to keep DOM light.
  const CAP = 600;
  const slice = words.slice(0, CAP);
  const frag = document.createDocumentFragment();
  for (const w of slice) {
    const el = document.createElement('span');
    el.className = 'word';
    el.textContent = w;
    if (state.solSet.has(w)) {
      el.classList.add('solution');
      el.title = 'possible Wordle solution';
    }
    frag.appendChild(el);
  }
  els.rows.appendChild(frag);
  if (words.length > CAP) {
    const more = document.createElement('span');
    more.className = 'word muted';
    more.textContent = `+${(words.length - CAP).toLocaleString()} more…`;
    more.title = 'narrow your filters to see the rest';
    els.rows.appendChild(more);
  }
}

// ---------- Keyboard (guess mode) ----------

function onKeyDown(e) {
  if (state.mode !== 'guess') return;
  // Don't hijack typing in form fields (manual mode handles its own).
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

  if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); moveCursor(0, -1); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(0, +1); return; }
  if (e.key === 'ArrowUp')    { e.preventDefault(); moveCursor(-1, 0); return; }
  if (e.key === 'ArrowDown')  { e.preventDefault(); moveCursor(+1, 0); return; }
  if (/^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault();
    typeLetter(e.key.toLowerCase());
  }
}

// ---------- Init ----------

function wire() {
  els.tabGuess.addEventListener('click', () => setMode('guess'));
  els.tabManual.addEventListener('click', () => setMode('manual'));
  els.resetBoard.addEventListener('click', resetBoard);
  els.resetPins.addEventListener('click', resetPins);
  els.resetLetters.addEventListener('click', resetLetters);
  els.optSolOnly.addEventListener('change', compute);
  els.optSolFirst.addEventListener('change', compute);
  window.addEventListener('keydown', onKeyDown);
}

(async function init() {
  buildBoard();
  buildPins();
  buildLetters();
  wire();
  try {
    await loadData();
  } catch (err) {
    els.stats.textContent = 'failed to load dictionary';
    console.error(err);
    return;
  }
  compute();
})();
