# Well-Tempered Quartet

A personal project to perform one string quartet in each of the 24 keys of Bach's
*Well-Tempered Clavier* — one prelude-and-fugue key per concert, covering all
major and minor tonalities. The dashboard tracks candidate repertoire and marks
keys as complete over time.

Started with [this claude chat](https://claude.ai/chat/ed36e476-e218-45a4-a092-d9f9bb66d561)

**Live site**: [jsundram.github.io/wtq](https://jsundram.github.io/wtq/)

## How it works

The dashboard fetches data directly from a [published Google Sheet](https://docs.google.com/spreadsheets/d/13HGcnzgv6SlDq3_TLyeP01JslbrQqY6GGZBjbzqOSBE/edit?gid=0#gid=0) as xlsx, parses it in the browser using [SheetJS](https://sheetjs.com/), and renders the results. Edit the spreadsheet and the site updates automatically — no build or deploy step needed.

Data is cached in `localStorage` for instant rendering on repeat visits, with a background refresh when the sheet is reachable.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Mobile-optimised dashboard (HTML + CSS) |
| `js/data.js` | Fetches and parses the Google Sheet xlsx, manages cache |
| `js/app.js` | Dashboard rendering, state, circle of fifths |
| `manifest.json` | Web app manifest (iOS home screen support) |
| `favicon/` | App icons (SVG, PNG, ICO) |
| `some_quartets_by_key.xlsx` | Local export of the source spreadsheet |
| `xlsx_to_json.py` | Python conversion script (development/validation) |
| `played_to_json.py` | Python script to extract played pieces (development) |
| `quartets.json` | Generated data (Python pipeline output) |
| `played.json` | Generated played pieces (Python pipeline output) |
| `quartets.schema.json` | JSON Schema (draft 2020-12) for `quartets.json` |
| `build.sh` | Runs Python conversion + validation |
| `test_parse.mjs` | Tests JS parsing against Python output |

## Development

```bash
# Serve locally
python3 -m http.server 8000
# open http://localhost:8000/

# Validate Python pipeline (requires uv)
./build.sh

# Test JS parsing matches Python output (requires node)
curl -sL "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" -o /tmp/xlsx.mjs
node test_parse.mjs
```

`build.sh` uses [`uv`](https://github.com/astral-sh/uv) to run Python with
inline dependencies (`openpyxl`, `jsonschema`) — no virtualenv setup needed.

## Spreadsheet conventions

The xlsx encodes editorial status via **cell background colour**:

| Colour | Hex | Meaning |
|--------|-----|---------|
| White (none) | — | **candidate** — primary selection for this key |
| Yellow | `FFF2CC` | **uncertain** — tonality questionable or key is a stretch |
| Light grey | `CCCCCC` | **alternate** — viable backup option |
| Dark grey | `999999` | **rejected** — struck from consideration |
| Pink | `F4CCCC` | *(empty placeholder row — skipped)* |

The dashboard displays candidates prominently; alternates and uncertain entries
are shown in subdued styles when a key is expanded.

## Key spellings and enharmonic equivalence

Keys follow Bach's canonical WTC spellings. Two keys in the spreadsheet use
enharmonic equivalents that are resolved automatically:

- **D♭ Major** (spreadsheet) → **C♯ Major** (Bach/WTC)
- **A♭ Minor** (spreadsheet) → **G♯ Minor** (Bach/WTC)

The dashboard shows both spellings where they differ.

## Dashboard features

- **Circle of fifths** at the top — outer ring = major, inner = minor; C at 12 o'clock.
  Sectors fill red (complete), partial red (some pieces played), or muted (pending).
  Tap any sector to jump to that key's row.
- **Progress rings** on each key row reflect how many candidate pieces have been
  played (arc fills proportionally).
- **Partial completion** is tracked independently from marking a key "done" — the
  ring fills as individual pieces are checked, but the key isn't counted complete
  until the circle check is tapped.
- **Status badges** distinguish candidates, alternates, uncertain, and rejected entries.
- **Score and video links** pulled from IMSLP and YouTube URLs in the spreadsheet.
- **localStorage** persistence — all check state survives page reloads, no server needed.
- **Stale-while-revalidate caching** — renders cached data instantly, refreshes from Google Sheets in background.
- **Data source indicator** in footer shows whether data is live, cached, or offline.
- Keys with only uncertain candidates show a ⚠ warning.

## Data schema

`quartets.schema.json` describes the structure of `quartets.json`. Key fields:

```
sharps      number    key-signature position (negative = flats, range −7…+7)
key         string    tonal centre as spelled in xlsx (may be enharmonic)
mode        string    "Major" | "Minor" | "n/a"
composer    string    surname (+ initial where needed)
piece       string    opus/catalogue number or short title; "" if TBD
notes       string    free-text tonality or fugal content notes
scoreUrl    string    IMSLP URL or ""
ytUrl       string    YouTube URL or "" (extracted from prose if needed)
status      string    "candidate" | "uncertain" | "alternate" | "rejected"
```
