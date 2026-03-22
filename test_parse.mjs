#!/usr/bin/env node
/**
 * Test that the JS xlsx parsing logic produces the same output as the Python pipeline.
 * Compares against quartets.json (known-good) and played.json (if present).
 *
 * Usage: node test_parse.mjs
 */
import { readFileSync } from 'fs';

// Load standalone SheetJS ESM bundle (no npm required)
// Download once: curl -sL "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" -o /tmp/xlsx.mjs
import * as XLSX from '/tmp/xlsx.mjs';
globalThis.XLSX = XLSX;

// ── Port of js/data.js parsing logic (can't import directly due to browser APIs) ──

const COLOR_STATUS = {
  'FFF2CC': 'uncertain',
  'CCCCCC': 'alternate',
  '999999': 'rejected',
  'F4CCCC': null,
};

function getCellFill(cell) {
  if (!cell || !cell.s) return null;
  if (cell.s.patternType === 'none') return null;
  const fg = cell.s.fgColor;
  if (!fg || !fg.rgb) return null;
  let rgb = fg.rgb;
  if (rgb.length === 8 && rgb.startsWith('FF')) rgb = rgb.slice(2);
  return rgb;
}

function statusFromFill(cell) {
  const rgb = getCellFill(cell);
  if (!rgb) return 'candidate';
  return COLOR_STATUS[rgb] !== undefined ? COLOR_STATUS[rgb] : 'candidate';
}

function cleanStr(val) {
  if (val == null) return '';
  return String(val).trim();
}

function cleanPiece(val) {
  if (val instanceof Date) return '';
  if (typeof val === 'number') {
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

  for (let r = 1; r <= range.e.r; r++) {
    const composer = cleanStr(cellVal(ws, r, 5));
    if (!composer) continue;

    const status = statusFromFill(cellObj(ws, r, 0));
    if (status === null) continue;

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
      if (dateVal instanceof Date) {
        dateStr = dateVal.toISOString().slice(0, 10);
      } else if (typeof dateVal === 'number') {
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

// ── Test runner ──────────────────────────────────────────────────────────

function diffPieces(expected, actual, label) {
  let pass = true;

  if (expected.length !== actual.length) {
    console.log(`  ✗ ${label}: count mismatch — expected ${expected.length}, got ${actual.length}`);
    pass = false;
  }

  const n = Math.min(expected.length, actual.length);
  let fieldMismatches = 0;
  let warnings = 0;
  for (let i = 0; i < n; i++) {
    const e = expected[i], a = actual[i];
    const allKeys = new Set([...Object.keys(e), ...Object.keys(a)]);
    for (const k of allKeys) {
      const ev = String(e[k] ?? ''), av = String(a[k] ?? '');
      if (ev !== av) {
        // Float cleanup difference (e.g. "105.0" vs "105") — warn, don't fail
        if (k === 'piece' && /^\d+\.0$/.test(ev) && av === ev.slice(0, -2)) {
          if (warnings < 5) console.log(`  ~ ${label}[${i}].${k}: "${ev}" → "${av}" (float cleanup, ok)`);
          warnings++;
          continue;
        }
        if (fieldMismatches < 10) {
          console.log(`  ✗ ${label}[${i}].${k}: expected ${JSON.stringify(e[k])}, got ${JSON.stringify(a[k])}`);
        }
        fieldMismatches++;
        pass = false;
      }
    }
  }

  if (fieldMismatches > 10) {
    console.log(`  ... and ${fieldMismatches - 10} more field mismatches`);
  }
  if (warnings > 5) {
    console.log(`  ... and ${warnings - 5} more float cleanup warnings`);
  }

  if (pass) {
    console.log(`  ✓ ${label}: ${expected.length} entries match${warnings ? ` (${warnings} float cleanups)` : ''}`);
  }
  return pass;
}

// ── Main ─────────────────────────────────────────────────────────────────

const xlsxPath = 'some_quartets_by_key.xlsx';
const buf = readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: 'buffer', cellStyles: true, cellDates: true });

// Test quartets
const jsPieces = parseQuartetsSheet(wb);
const pyPieces = JSON.parse(readFileSync('quartets.json', 'utf-8'));
const q = diffPieces(pyPieces, jsPieces, 'quartets');

// Test played (if reference file exists)
let p = true;
try {
  const jsPlayed = parsePlayedSheet(wb);
  const pyPlayed = JSON.parse(readFileSync('played.json', 'utf-8'));
  p = diffPieces(pyPlayed, jsPlayed, 'played');
} catch {
  console.log('  — played.json not found, skipping played sheet comparison');
}

console.log();
if (q && p) {
  console.log('All tests passed.');
  process.exit(0);
} else {
  console.log('Some tests failed.');
  process.exit(1);
}
