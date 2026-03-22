# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Well-Tempered Quartet — a personal project to perform one string quartet in each of the 24 keys of Bach's *Well-Tempered Clavier*. Tracks candidate repertoire and marks keys complete over time.

## Serve locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

The live site fetches data directly from a published Google Sheet — no build step needed for normal use.

## Validate (development)

```bash
# Convert xlsx → JSON and validate against schema (requires uv)
./build.sh

# Test that JS xlsx parsing matches Python output (requires node + /tmp/xlsx.mjs)
curl -sL "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" -o /tmp/xlsx.mjs
node test_parse.mjs
```

`build.sh` uses `uv` with inline dependencies (`openpyxl`, `jsonschema`) — no virtualenv needed. It runs conversion, schema validation, orphan detection, and duplicate ID checks.

## Architecture

**Live data flow**: Google Sheet → published xlsx URL → `js/data.js` (SheetJS in browser) → render

**Offline/dev flow**: `some_quartets_by_key.xlsx` → `xlsx_to_json.py` → `quartets.json` → schema validation

Key files:
- **`index.html`** — HTML + CSS only, no inline JS. Loads SheetJS from CDN.
- **`js/data.js`** — fetches published Google Sheet xlsx, parses both sheets (`>48 by key` and `Played`) using SheetJS, caches in `localStorage` (`wtq_data_v1`). Uses stale-while-revalidate: renders from cache immediately, fetches fresh data in background, falls back to static `quartets.json` if all else fails.
- **`js/app.js`** — dashboard rendering, state management (`localStorage` key: `wtq_v2`), circle of fifths SVG, progress rings. Imports from `data.js` as ES module.
- **`build.sh`** — Python-based validation pipeline. Extracts KEYS aliases from `js/app.js` for orphan detection.
- **`test_parse.mjs`** — Node test that compares JS xlsx parsing against Python-generated `quartets.json` and `played.json`.

## Key details

- Two enharmonic mappings: D♭ Major → C♯ Major, A♭ Minor → G♯ Minor (Bach's canonical WTC spellings).
- `quartets.json` is generated — edit the spreadsheet, not the JSON.
- The xlsx worksheets parsed: `">48 by key"` (pieces) and `"Played "` (trailing space).
- SheetJS uses 6-char hex for cell fill colors (e.g. `FFF2CC`); openpyxl uses 8-char with `FF` prefix (`FFFFF2CC`). Both are handled.
- Piece IDs include composer + piece name to avoid collisions when same composer appears twice in a key.
