# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Well-Tempered Quartet — a personal project to perform one string quartet in each of the 24 keys of Bach's *Well-Tempered Clavier*. Tracks candidate repertoire and marks keys complete over time.

## Build & Serve

```bash
# Convert xlsx → JSON and validate against schema (requires uv)
./build.sh

# Serve locally (dashboard uses fetch(), needs HTTP server)
python3 -m http.server 8000
# open http://localhost:8000/
```

`uv` handles inline dependencies (`openpyxl`, `jsonschema`) — no virtualenv needed.

## Architecture

Flat repo, three-stage pipeline:

1. **Source of truth**: `some_quartets_by_key.xlsx` (exported from Google Sheets). Cell background colours encode editorial status (candidate/uncertain/alternate/rejected).
2. **Conversion**: `xlsx_to_json.py` reads the xlsx, maps cell colours to status strings, extracts YouTube URLs from prose, and outputs `quartets.json`. Validated against `quartets.schema.json` (JSON Schema draft 2020-12).
3. **Dashboard**: `index.html` — single self-contained HTML file (HTML + CSS + JS, no build tools, no npm). Renders a circle-of-fifths SVG, per-key rows with progress rings, and piece lists. Piece list loaded from `quartets.json`. State persisted in `localStorage` (key: `wtq_v2`).

## Key details

- Two enharmonic mappings: D♭ Major → C♯ Major, A♭ Minor → G♯ Minor (Bach's canonical WTC spellings).
- `quartets.json` is generated — edit the spreadsheet, not the JSON.
- The xlsx worksheet parsed is named `">48 by key"`.
