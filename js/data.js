// ── Data layer: fetch, parse, and cache spreadsheet data ─────────────────
// Replaces xlsx_to_json.py and played_to_json.py with client-side parsing.

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUeibVyaknec_0d3Hj_DE-tHspnV3USBVtXnW9roQPfv0GBlcn8dfgyDXFlnwI6ol7FqyUDIQbdEjU/pub?output=xlsx';
const CACHE_KEY = 'wtq_data_v1';
const FETCH_TIMEOUT = 10000; // 10 seconds

// ── Color → status mapping (matches xlsx_to_json.py) ─────────────────────
// SheetJS stores theme/tint fills differently from openpyxl; we map both
// the rgb hex and fall back to pattern matching.
// Map fill color → status. SheetJS uses 6-char hex (e.g. "FFF2CC"),
// openpyxl uses 8-char with FF prefix (e.g. "FFFFF2CC"). We normalize
// to 6-char by stripping a leading "FF" when the string is 8 chars.
const COLOR_STATUS = {
  'FFF2CC': 'uncertain',
  'CCCCCC': 'alternate',
  '999999': 'rejected',
  'F4CCCC': null,       // pink placeholder — skip
};

function getCellFill(cell) {
  if (!cell || !cell.s) return null;
  if (cell.s.patternType === 'none') return null;
  const fg = cell.s.fgColor;
  if (!fg || !fg.rgb) return null;
  // Normalize: strip leading "FF" alpha from 8-char hex
  let rgb = fg.rgb;
  if (rgb.length === 8 && rgb.startsWith('FF')) rgb = rgb.slice(2);
  return rgb;
}

function statusFromFill(cell) {
  const rgb = getCellFill(cell);
  if (!rgb) return 'candidate';
  return COLOR_STATUS[rgb] !== undefined ? COLOR_STATUS[rgb] : 'candidate';
}

// ── Helpers (ported from Python) ─────────────────────────────────────────

function cleanStr(val) {
  if (val == null) return '';
  return String(val).trim();
}

function cleanPiece(val) {
  // Excel/SheetJS may store text as Date objects or floats
  if (val instanceof Date) return '';
  if (typeof val === 'number') {
    // Integer stored as float (e.g. 105.0 → "105")
    return Number.isInteger(val) ? String(val) : String(val);
  }
  let s = cleanStr(val);
  if (/^\d{4}-\d{2}-\d{2}[ T]/.test(s)) return '';
  if (/^\d+\.0$/.test(s)) s = s.slice(0, -2);
  return s;
}

function extractYtUrl(raw) {
  const m = (raw || '').match(/https?:\/\/[^\s]*youtu[^\s]*/);
  return m ? m[0] : '';
}

function normalizeKey(raw) {
  const parts = raw.split('-', 2);
  if (parts.length === 2) return parts[0] + '-' + parts[1].toLowerCase();
  return raw;
}

// ── Sheet parsing ────────────────────────────────────────────────────────

function cellVal(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  return cell ? cell.v : null;
}

function cellObj(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  return ws[addr] || null;
}

function parseQuartetsSheet(wb) {
  const ws = wb.Sheets['>48 by key'];
  if (!ws) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const pieces = [];

  for (let r = 1; r <= range.e.r; r++) { // skip header row
    // Column 0 is "Date played"; data starts at column 1
    const composer = cleanStr(cellVal(ws, r, 5));
    if (!composer) continue;

    const status = statusFromFill(cellObj(ws, r, 0));
    if (status === null) continue; // pink placeholder

    let sharps = cellVal(ws, r, 1);
    sharps = (sharps != null && !isNaN(Number(sharps))) ? Number(sharps) : 0;

    pieces.push({
      sharps,
      key:      cleanStr(cellVal(ws, r, 2)).replace(/[*?]+$/, ''),
      mode:     cleanStr(cellVal(ws, r, 3)),
      composer,
      piece:    cleanPiece(cellVal(ws, r, 6)),
      notes:    cleanStr(cellVal(ws, r, 7)),
      scoreUrl: cleanStr(cellVal(ws, r, 9)),
      ytUrl:    extractYtUrl(cleanStr(cellVal(ws, r, 10))),
      status,
    });
  }
  return pieces;
}

function parsePlayedSheet(wb) {
  const ws = wb.Sheets['Played '] || wb.Sheets['Played'];
  if (!ws) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const played = [];

  for (let r = 1; r <= range.e.r; r++) {
    const include = cleanStr(cellVal(ws, r, 4)).toUpperCase();
    if (include === 'N/A') continue;

    const sharps = cellVal(ws, r, 5);
    const tonalCenter = cleanStr(cellVal(ws, r, 6));
    if (sharps == null || !tonalCenter) continue;

    const dateVal = cellVal(ws, r, 0);
    let dateStr = '';
    if (dateVal != null) {
      // SheetJS stores dates as JS Date objects when cellDates is true
      if (dateVal instanceof Date) {
        dateStr = dateVal.toISOString().slice(0, 10);
      } else if (typeof dateVal === 'number') {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(dateVal);
        dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      }
    }

    played.push({
      date:     dateStr,
      composer: cleanStr(cellVal(ws, r, 1)),
      piece:    cleanPiece(cellVal(ws, r, 2)),
      part:     cleanStr(cellVal(ws, r, 3)),
      include:  cleanStr(cellVal(ws, r, 4)),
      sharps:   Number(sharps),
      key:      normalizeKey(tonalCenter),
      mode:     cleanStr(cellVal(ws, r, 7)),
    });
  }
  return played;
}

// ── Cache ────────────────────────────────────────────────────────────────

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCache(data) {
  try {
    data.cachedAt = new Date().toISOString();
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — ignore */ }
}

// ── Fetch + parse ────────────────────────────────────────────────────────

async function fetchFromSheet() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(SHEET_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellStyles: true, cellDates: true });
    return {
      pieces: parseQuartetsSheet(wb),
      played: parsePlayedSheet(wb),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromStatic() {
  const res = await fetch('quartets.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const pieces = await res.json();
  return { pieces, played: [] };
}

// ── Public API ───────────────────────────────────────────────────────────
// Returns cached data immediately (if available) and fetches fresh data
// in the background. Calls onUpdate when fresh data arrives.

export async function loadData(onUpdate) {
  const cached = getCached();

  // Start background fetch regardless
  const freshPromise = fetchFromSheet().then(fresh => {
    setCache(fresh);
    onUpdate(fresh, 'live');
    return fresh;
  }).catch(err => {
    console.warn('Sheet fetch failed:', err.message);
    return null;
  });

  // If we have cache, return it immediately
  if (cached && cached.pieces) {
    return { data: cached, source: 'cache' };
  }

  // No cache — wait for the sheet fetch
  const fresh = await freshPromise;
  if (fresh) return { data: fresh, source: 'live' };

  // Sheet fetch also failed — fall back to static quartets.json
  try {
    const fallback = await fetchFromStatic();
    setCache(fallback);
    return { data: fallback, source: 'static' };
  } catch (err) {
    throw new Error(`All data sources failed. ${err.message}`);
  }
}
