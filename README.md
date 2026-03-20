# Well-Tempered Quartet

A personal project to perform one string quartet in each of the 24 keys of Bach's
*Well-Tempered Clavier* — one prelude-and-fugue key per concert, covering all
major and minor tonalities. The dashboard tracks candidate repertoire and marks
keys as complete over time.

Started with [this claude chat](https://claude.ai/chat/ed36e476-e218-45a4-a092-d9f9bb66d561)

## Files

| File | Purpose |
|------|---------|
| `some_quartets_by_key.xlsx` | Source of truth — exported from google sheets [here](https://docs.google.com/spreadsheets/d/13HGcnzgv6SlDq3_TLyeP01JslbrQqY6GGZBjbzqOSBE/edit?gid=0#gid=0) |
| `xlsx_to_json.py` | Converts the xlsx to `quartets.json` |
| `quartets.json` | Generated data consumed by the dashboard |
| `quartets.schema.json` | JSON Schema (draft 2020-12) for `quartets.json` |
| `index.html` | Mobile-optimised dashboard |
| `build.sh` | Runs conversion + validation (see below) |

## Workflow

```bash
# 1. Edit some_quartets_by_key.xlsx in Excel / Numbers

# 2. Rebuild — converts xlsx and validates the output
./build.sh

# 3. Serve locally (fetch() requires a real server, not file://)
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

`build.sh` uses [`uv`](https://github.com/astral-sh/uv) to run Python with
inline dependencies (`openpyxl`, `jsonschema`) — no virtualenv setup needed.

## Spreadsheet conventions

The xlsx encodes editorial status via **cell background colour**:

| Colour | Hex | Meaning |
|--------|-----|---------|
| White (none) | `00000000` | **candidate** — primary selection for this key |
| Yellow | `FFFFF2CC` | **uncertain** — tonality questionable or key is a stretch |
| Light grey | `FFCCCCCC` | **alternate** — viable backup option |
| Dark grey | `FF999999` | **rejected** — struck from consideration |
| Pink | `FFF4CCCC` | *(empty placeholder row — skipped)* |

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
- Keys with only uncertain candidates show a ⚠ warning (e.g. B Major currently has
  no confirmed pieces).

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

Validate manually at any time:
```bash
uv run --with jsonschema python3 -c "
import json
from jsonschema import validate
from pathlib import Path
validate(json.loads(Path('quartets.json').read_text()),
         json.loads(Path('quartets.schema.json').read_text()))
print('ok')
"
```
