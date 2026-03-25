# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Well-Tempered Quartet — a personal project to perform **two** string quartets in each of the 24 keys of Bach's *Well-Tempered Clavier* (48 total). Tracks candidate repertoire, played performances, and marks keys complete over time.

## Serve locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

The live site fetches data directly from a published Google Sheet — no build step needed.

## Architecture

**Data flow**: Google Sheet → published xlsx URL → `js/data.js` (SheetJS in browser) → `js/app.js` → render

Key files:
- **`index.html`** — HTML + CSS only, no inline JS. Loads SheetJS from CDN.
- **`js/data.js`** — fetches published Google Sheet xlsx, parses both sheets (`>48 by key` and `Played`) using SheetJS, caches in `localStorage` (`wtq_data_v1`). Uses stale-while-revalidate: renders from cache immediately, fetches fresh data in background.
- **`js/app.js`** — dashboard rendering, state management (`localStorage` key: `wtq_v2`), circle of fifths SVG, progress rings. Imports from `data.js` as ES module.

## Column layouts (0-indexed)

**">48 by key" sheet** (`parseQuartetsSheet` in data.js):
| Col | Field |
|-----|-------|
| 0 | status (from cell fill color) |
| 1 | sharps |
| 2 | key |
| 3 | mode |
| 5 | composer |
| 6 | piece (use `cellText` — may be Date) |
| 7 | notes |
| 9 | scoreUrl |
| 10 | ytUrl |

**"Played " sheet** (`parsePlayedSheet` in data.js):
| Col | Field |
|-----|-------|
| 0 | date |
| 1 | composer |
| 2 | piece |
| 3 | part |
| 4 | include (Y/M/n/N/A) |
| 5 | sharps |
| 6 | tonal center (key) |
| 7 | mode |

## Key details

- **Counting**: each key contributes up to 2 pieces toward the 48-slot total. Progress is shown as X/48.
- **Circle of fifths**: outer ring = major (uppercase), inner ring = minor (lowercase). A sector goes solid red only when 2+ pieces are done or the key is manually marked complete.
- Two enharmonic mappings: D♭ Major → C♯ Major, A♭ Minor → G♯ Minor (Bach's canonical WTC spellings).
- **Key name normalization**: `normKey()` in app.js converts `-sharp` → `#` and `-flat` → `b` so the Played sheet can use any spelling variant.
- The xlsx worksheets parsed: `">48 by key"` (pieces) and `"Played "` (trailing space in sheet name).
- **Played sheet filtering**: only rows with `include` column value of `Y` or `M` are matched to pieces. `N/A` rows are skipped during parsing; `n` rows are skipped during matching.
- SheetJS uses 6-char hex for cell fill colors (e.g. `FFF2CC`).
- **Date-like piece names** (e.g. "2/3"): SheetJS with `cellDates: true` may parse these as Date objects. `cellText()` in data.js recovers the display text via the cell's `.w` property.
- Piece IDs include composer + piece name to avoid collisions when same composer appears twice in a key.
- Debug logging: `applyPlayedState()` logs `[played]` warnings to console for unmatched keys/pieces (only on the live data pass, not cache).
