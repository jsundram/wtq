# Well-Tempered Quartet

A personal project to perform two string quartets in each of the 24 keys of Bach's
*Well-Tempered Clavier* — 48 pieces total, covering all major and minor tonalities.
The dashboard tracks candidate repertoire, played performances, and marks keys
complete over time.

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

## Development

```bash
# Serve locally
python3 -m http.server 8000
# open http://localhost:8000/
```

## Spreadsheet conventions

The Google Sheet has two worksheets:

- **`>48 by key`** — candidate quartets organized by key, with editorial status encoded via cell background colour
- **`Played`** — performance log with date, composer, piece, part, and an `include` column (`Y` = count toward progress, `M` = maybe, `n` = don't count, `N/A` = skip entirely)

### Cell colours (">48 by key" sheet)

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

Key names are normalized before matching (`-sharp` → `#`, `-flat` → `b`), so
the Played sheet can use any common spelling variant.

## Dashboard features

- **Circle of fifths** at the top — outer ring = major (uppercase), inner = minor (lowercase); C at 12 o'clock.
  Sectors fill red when 2+ pieces are done, partial red when some pieces are played, or muted when pending.
  Tap any sector to jump to that key's row.
- **Progress counting** — each key contributes up to 2 pieces toward the 48-slot total (X/48).
- **Progress rings** on each key row reflect how many candidate pieces have been
  played (arc fills proportionally).
- **Played sheet integration** — performances logged in the Played sheet automatically check off matching pieces in the dashboard.
- **Status badges** distinguish candidates, alternates, uncertain, and rejected entries.
- **Score and video links** pulled from IMSLP and YouTube URLs in the spreadsheet.
- **localStorage** persistence — all check state survives page reloads, no server needed.
- **Stale-while-revalidate caching** — renders cached data instantly, refreshes from Google Sheets in background.
- **Data source indicator** in footer shows whether data is live, cached, or offline.
- Keys with only uncertain candidates show a warning.
