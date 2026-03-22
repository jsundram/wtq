import { loadData } from './data.js';

// ── Data ─────────────────────────────────────────────────────────────────
let PIECES = [];
let PLAYED = [];

// ── Key definitions (canonical Bach/WTC spellings) ──────────────────────
const KEYS = [
  { k:'C',   m:'Major', disp:'C',   enh:null,           aliases:[['C','Major']] },
  { k:'C',   m:'Minor', disp:'C',   enh:null,           aliases:[['C','Minor']] },
  { k:'C♯',  m:'Major', disp:'C♯',  enh:'D♭ in score',  aliases:[['C#','Major'],['D-flat','Major'],['Db','Major']] },
  { k:'C♯',  m:'Minor', disp:'C♯',  enh:null,           aliases:[['C#','Minor']] },
  { k:'D',   m:'Major', disp:'D',   enh:null,           aliases:[['D','Major']] },
  { k:'D',   m:'Minor', disp:'D',   enh:null,           aliases:[['D','Minor']] },
  { k:'E♭',  m:'Major', disp:'E♭',  enh:null,           aliases:[['Eb','Major'],['E-flat','Major']] },
  { k:'E♭',  m:'Minor', disp:'E♭',  enh:null,           aliases:[['Eb','Minor'],['E-flat','Minor']] },
  { k:'E',   m:'Major', disp:'E',   enh:null,           aliases:[['E','Major']] },
  { k:'E',   m:'Minor', disp:'E',   enh:null,           aliases:[['E','Minor']] },
  { k:'F',   m:'Major', disp:'F',   enh:null,           aliases:[['F','Major']] },
  { k:'F',   m:'Minor', disp:'F',   enh:null,           aliases:[['F','Minor']] },
  { k:'F♯',  m:'Major', disp:'F♯',  enh:null,           aliases:[['F#','Major'],['F-sharp','Major']] },
  { k:'F♯',  m:'Minor', disp:'F♯',  enh:null,           aliases:[['F#','Minor'],['F-sharp','Minor']] },
  { k:'G',   m:'Major', disp:'G',   enh:null,           aliases:[['G','Major']] },
  { k:'G',   m:'Minor', disp:'G',   enh:null,           aliases:[['G','Minor']] },
  { k:'A♭',  m:'Major', disp:'A♭',  enh:null,           aliases:[['Ab','Major'],['A-flat','Major']] },
  { k:'G♯',  m:'Minor', disp:'G♯',  enh:'A♭ in score',  aliases:[['G#','Minor'],['Ab','Minor'],['A-flat','Minor']] },
  { k:'A',   m:'Major', disp:'A',   enh:null,           aliases:[['A','Major']] },
  { k:'A',   m:'Minor', disp:'A',   enh:null,           aliases:[['A','Minor']] },
  { k:'B♭',  m:'Major', disp:'B♭',  enh:null,           aliases:[['Bb','Major'],['B-flat','Major']] },
  { k:'B♭',  m:'Minor', disp:'B♭',  enh:null,           aliases:[['Bb','Minor'],['B-flat','Minor']] },
  { k:'B',   m:'Major', disp:'B',   enh:null,           aliases:[['B','Major']] },
  { k:'B',   m:'Minor', disp:'B',   enh:null,           aliases:[['B','Minor']] },
];

const COF_MAJOR_IDX = [0, 14, 4, 18, 8, 22, 12, 2, 16, 6, 20, 10];
const COF_MINOR_IDX = [19, 9, 23, 13, 3, 17, 7, 21, 11, 1, 15, 5];

// ── State & helpers ─────────────────────────────────────────────────────
const LS = 'wtq_v2';
const loadState = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const saveState = s => localStorage.setItem(LS, JSON.stringify(s));
let state = loadState();

function pieceMatches(p, key) {
  return key.aliases.some(([k, m]) => p.key === k && p.mode === m);
}
function piecesForKey(key)     { return PIECES.filter(p => pieceMatches(p, key)); }
function candidatesForKey(key) { return piecesForKey(key).filter(p => p.status === 'candidate'); }

function pid(key, p) { return `p_${key.k}_${key.m}_${p.composer}_${p.piece}`; }
function kid(key)    { return `key_${key.k}_${key.m}`; }

function keyStats(key) {
  const candidates = candidatesForKey(key);
  const done = candidates.filter(p => state[pid(key, p)]);
  return { total: candidates.length, done: done.length };
}

function ytLink(raw) {
  const m = (raw||'').match(/https?:\/\/[^\s]*youtu[^\s]*/);
  return m ? m[0] : '';
}

// ── Circle of Fifths ────────────────────────────────────────────────────
const toRad = deg => (deg - 90) * Math.PI / 180;
const R_OUTER_OUT = 130, R_OUTER_IN = 95;
const R_INNER_OUT = 92,  R_INNER_IN = 62;
const R_LABEL_OUTER = 112, R_LABEL_INNER = 77;
const GAP_DEG = 2;

function arcPath(r1, r2, startDeg, endDeg) {
  const s = startDeg + GAP_DEG/2, e = endDeg - GAP_DEG/2;
  const x1 = r2 * Math.cos(toRad(s)), y1 = r2 * Math.sin(toRad(s));
  const x2 = r2 * Math.cos(toRad(e)), y2 = r2 * Math.sin(toRad(e));
  const x3 = r1 * Math.cos(toRad(e)), y3 = r1 * Math.sin(toRad(e));
  const x4 = r1 * Math.cos(toRad(s)), y4 = r1 * Math.sin(toRad(s));
  const lg = (e - s > 180) ? 1 : 0;
  return `M${x1},${y1} A${r2},${r2} 0 ${lg},1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 ${lg},0 ${x4},${y4}Z`;
}

function sectorFill(keyIdx) {
  const key = KEYS[keyIdx];
  const { total, done } = keyStats(key);
  const keyDone = !!state[kid(key)];
  const allUncertain = piecesForKey(key).every(p => p.status === 'uncertain' || p.status === 'alternate');
  if (keyDone || (total > 0 && done === total)) return '#8b1a1a';
  if (done > 0) return 'rgba(139,26,26,0.38)';
  if (allUncertain && total === 0) return 'rgba(196,154,30,0.28)';
  return 'rgba(200,191,170,0.35)';
}

function sectorStroke(keyIdx) {
  const key = KEYS[keyIdx];
  const { total, done } = keyStats(key);
  const keyDone = !!state[kid(key)];
  if (keyDone || (total > 0 && done === total)) return '#6b1010';
  if (done > 0) return 'rgba(139,26,26,0.6)';
  return 'rgba(150,140,120,0.5)';
}

function buildCoF() {
  const svg = document.getElementById('cofSvg');
  svg.innerHTML = '';

  function addSectors(indices, rIn, rOut, rLabel, fontSize, italic) {
    indices.forEach((ki, pos) => {
      const startDeg = pos * 30 - 15, endDeg = (pos + 1) * 30 - 15;
      const midDeg = pos * 30;
      const key = KEYS[ki];
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('cof-sector');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', arcPath(rIn, rOut, startDeg, endDeg));
      path.setAttribute('fill', sectorFill(ki));
      path.setAttribute('stroke', sectorStroke(ki));
      path.setAttribute('stroke-width', '0.5');
      g.appendChild(path);

      const lx = rLabel * Math.cos(toRad(midDeg));
      const ly = rLabel * Math.sin(toRad(midDeg));
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', lx); text.setAttribute('y', ly);
      text.setAttribute('font-size', fontSize);
      text.setAttribute('fill', sectorFill(ki) === '#8b1a1a' ? '#f5f0e8' : (italic ? '#3a2e1e' : '#2a1e10'));
      if (italic) text.setAttribute('font-style', 'italic');
      text.classList.add('cof-label');
      text.textContent = key.disp;
      g.appendChild(text);

      g.addEventListener('click', () => scrollToKey(ki));
      svg.appendChild(g);
    });
  }

  addSectors(COF_MAJOR_IDX, R_OUTER_IN, R_OUTER_OUT, R_LABEL_OUTER, '10', false);
  addSectors(COF_MINOR_IDX, R_INNER_IN, R_INNER_OUT, R_LABEL_INNER, '8.5', true);

  // Center text
  const ct = (txt, y, sz, color='#1a1208') => {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', 0); t.setAttribute('y', y);
    t.setAttribute('font-size', sz); t.setAttribute('fill', color);
    t.classList.add('cof-center-text');
    t.textContent = txt;
    svg.appendChild(t);
  };
  const kd = KEYS.filter(key => state[kid(key)]).length;
  const pct = Math.round(kd / 24 * 100);
  ct('WTC', -10, '10');
  ct(`${kd}/24`, 6, '14', '#8b1a1a');
  ct(`${pct}%`, 20, '9', '#8a7a62');
}

// ── Progress ring helper ────────────────────────────────────────────────
function ringHTML(fraction, isDone) {
  const r = 10, circ = 2 * Math.PI * r;
  const dash = fraction * circ;
  const checkColor = isDone ? 'white' : 'var(--ink-mid)';
  return `<svg width="26" height="26" viewBox="0 0 26 26">
    <circle class="ring-bg" cx="13" cy="13" r="${r}"/>
    <circle class="ring-progress" cx="13" cy="13" r="${r}"
      stroke-dasharray="${dash} ${circ}" stroke-dashoffset="0"
      style="${isDone ? 'stroke:var(--red)' : ''}"/>
    ${isDone ? `<circle cx="13" cy="13" r="9" fill="var(--red)"/>` : ''}
    <text x="13" y="17" text-anchor="middle" font-size="10"
      fill="${checkColor}" font-family="EB Garamond, serif">✓</text>
  </svg>`;
}

// ── Render list ─────────────────────────────────────────────────────────
function scrollToKey(ki) {
  state[`open_${ki}`] = true;
  saveState(state);
  render();
  requestAnimationFrame(() => {
    const el = document.getElementById(`key_section_${ki}`);
    if (!el) return;
    const header = document.querySelector('header');
    const y = el.getBoundingClientRect().top + window.scrollY - header.offsetHeight;
    window.scrollTo({ top: y, behavior: 'smooth' });
    el.classList.add('highlighted');
    setTimeout(() => el.classList.remove('highlighted'), 1500);
  });
}

function render() {
  const list = document.getElementById('keysList');
  list.innerHTML = '';
  let keysDone = 0, pTotal = 0, pDone = 0;

  KEYS.forEach((key, ki) => {
    const pieces = piecesForKey(key);
    const candidates = candidatesForKey(key);
    const doneCount = candidates.filter(p => state[pid(key, p)]).length;
    const isKeyDone = !!state[kid(key)];
    const isOpen = !!state[`open_${ki}`];
    const allUncertain = candidates.length === 0;

    if (isKeyDone) keysDone++;
    pTotal += candidates.length;
    pDone += doneCount;

    const fraction = candidates.length > 0 ? doneCount / candidates.length : 0;

    const sec = document.createElement('div');
    sec.className = `key-section${isOpen ? ' open' : ''}`;
    sec.id = `key_section_${ki}`;

    const fracLabel = candidates.length > 0
      ? `<span class="key-progress-frac${doneCount > 0 && !isKeyDone ? ' partial' : ''}">${doneCount}/${candidates.length}</span>`
      : `<span class="key-progress-frac" style="color:var(--gold)">no candidates</span>`;

    const enhLine = key.enh
      ? `<div class="key-enharmonic">Bach spells: ${key.k} ${key.m}</div>`
      : '';
    const uncertainFlag = allUncertain
      ? `<div class="key-uncertain-flag">⚠ candidates unconfirmed</div>`
      : '';

    sec.innerHTML = `
      <div class="key-header">
        <div class="key-ring${isKeyDone ? ' done' : ''}" data-kid="${ki}">
          ${ringHTML(isKeyDone ? 1 : fraction, isKeyDone)}
        </div>
        <div class="key-name-block">
          <div class="key-name">${key.disp} <span style="font-style:italic;font-weight:400;color:var(--ink-mid);font-size:.9rem">${key.m}</span></div>
          ${enhLine}${uncertainFlag}
        </div>
        <div class="key-meta">
          ${fracLabel}
          <span class="key-chevron">▶</span>
        </div>
      </div>
      <div class="pieces-list">
        ${pieces.map(p => {
          const isDone = !!state[pid(key, p)];
          const yt = ytLink(p.ytUrl);
          return `<div class="piece-row ${p.status}">
            <div class="piece-check${isDone ? ' done' : ''}" data-pid="${pid(key, p)}">✓</div>
            <div class="piece-info">
              <div class="piece-composer">${p.composer}</div>
              ${p.piece && p.piece !== 'tbd' ? `<div class="piece-title">${p.piece}</div>` : ''}
              ${p.notes ? `<div class="piece-notes">${p.notes}</div>` : ''}
              <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:2px">
                ${p.status !== 'candidate' ? `<span class="status-badge">${p.status}</span>` : ''}
                ${p.scoreUrl ? `<a class="piece-link" href="${p.scoreUrl}" target="_blank">score</a>` : ''}
                ${yt ? `<a class="piece-link" href="${yt}" target="_blank">video</a>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    sec.querySelector('.key-ring').addEventListener('click', e => {
      e.stopPropagation();
      const i = +e.currentTarget.dataset.kid;
      const k = KEYS[i];
      state[kid(k)] = !state[kid(k)];
      saveState(state); render(); buildCoF();
    });

    sec.querySelector('.key-header').addEventListener('click', e => {
      if (e.target.closest('.key-ring')) return;
      state[`open_${ki}`] = !state[`open_${ki}`];
      saveState(state); render();
    });

    sec.querySelectorAll('[data-pid]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        state[el.dataset.pid] = !state[el.dataset.pid];
        saveState(state); render(); buildCoF();
      });
    });

    list.appendChild(sec);
  });

  // Stats
  document.getElementById('headerCounts').innerHTML = `<span>${keysDone}</span> / 24 keys`;
  document.getElementById('fKeys').textContent = `${keysDone}/24`;
  document.getElementById('fPieces').textContent = `${pDone}/${pTotal}`;
  document.getElementById('fPct').textContent = Math.round(keysDone / 24 * 100) + '%';

  const anyOpen = KEYS.some((_, ki) => state[`open_${ki}`]);
  const btn = document.getElementById('collapseAll');
  btn.textContent = anyOpen ? '\u25B2' : '\u25BC';
  btn.title = anyOpen ? 'Collapse all' : 'Expand all';
}

// ── Data source indicator ───────────────────────────────────────────────
function showSource(source) {
  const el = document.getElementById('dataSource');
  if (!el) return;
  const labels = { cache: 'cached', live: 'live', static: 'offline' };
  el.textContent = labels[source] || source;
  el.className = 'data-source ' + source;
}

// ── Init ────────────────────────────────────────────────────────────────
function renderAll(data, source) {
  PIECES = data.pieces || [];
  PLAYED = data.played || [];
  render();
  buildCoF();
  showSource(source);
}

async function init() {
  // Wire up collapse button
  document.getElementById('collapseAll').addEventListener('click', () => {
    const anyOpen = KEYS.some((_, ki) => state[`open_${ki}`]);
    KEYS.forEach((_, ki) => {
      if (anyOpen) delete state[`open_${ki}`];
      else state[`open_${ki}`] = true;
    });
    saveState(state);
    render();
    if (anyOpen) window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  try {
    const { data, source } = await loadData((freshData, freshSource) => {
      // Background update arrived — re-render with fresh data
      renderAll(freshData, freshSource);
    });
    renderAll(data, source);
  } catch (err) {
    document.getElementById('keysList').innerHTML =
      `<div style="padding:24px 16px;font-family:'Courier Prime',monospace;font-size:.8rem;color:#8b1a1a">
        Failed to load data: ${err.message}
      </div>`;
  }
}

init();
