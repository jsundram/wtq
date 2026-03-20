#!/usr/bin/env bash
set -euo pipefail

XLSX="${1:-some_quartets_by_key.xlsx}"
JSON="quartets.json"
SCHEMA="quartets.schema.json"

echo "▶ converting $XLSX → $JSON"
uv run --with openpyxl xlsx_to_json.py "$XLSX" "$JSON"

echo "▶ validating $JSON against $SCHEMA"
uv run --with jsonschema python3 - <<'EOF'
import json, sys
from pathlib import Path
from jsonschema import validate, ValidationError
from jsonschema.validators import validator_for

schema = json.loads(Path("quartets.schema.json").read_text())
data   = json.loads(Path("quartets.json").read_text())

cls = validator_for(schema)
cls.check_schema(schema)          # sanity-check the schema itself

try:
    validate(instance=data, schema=schema)
    print(f"  ✓ {len(data)} pieces, all valid")
except ValidationError as e:
    print(f"  ✗ validation error: {e.message}")
    print(f"    at: {' → '.join(str(p) for p in e.absolute_path)}")
    sys.exit(1)
EOF

echo "▶ checking for orphaned pieces and duplicate IDs"
uv run --with jsonschema python3 - <<'PYEOF'
import json, re, sys
from pathlib import Path

data   = json.loads(Path("quartets.json").read_text())
html   = Path("index.html").read_text()
errors = []

# --- Extract dashboard aliases from index.html ---
# Matches: aliases:[['C','Major'],['D-flat','Major']]
aliases = set()
for match in re.finditer(r"aliases:\[(\[.+?\])\]", html):
    for pair in re.finditer(r"\['([^']+)','([^']+)'\]", match.group(1)):
        aliases.add((pair.group(1), pair.group(2)))

# --- 1. Orphan detection: every piece should match a dashboard alias ---
for i, p in enumerate(data):
    k, m = p["key"], p["mode"]
    if (k, m) not in aliases:
        errors.append(f"  piece {i}: ({k}, {m}) — {p['composer']} has no matching dashboard alias")

if errors:
    print(f"  ⚠ {len(errors)} orphaned piece(s) (not displayed by dashboard):")
    for e in errors:
        print(e)
else:
    print(f"  ✓ all {len(data)} pieces match a dashboard alias")

# --- 2. Unique piece IDs ---
seen = {}
dupes = []
for i, p in enumerate(data):
    pid = f"p_{p['key']}_{p['mode']}_{p['composer']}_{p['piece']}"
    if pid in seen:
        dupes.append(f"  piece {i} collides with piece {seen[pid]}: {pid}")
    else:
        seen[pid] = i

if dupes:
    print(f"  ✗ {len(dupes)} duplicate piece ID(s):")
    for d in dupes:
        print(d)
    sys.exit(1)
else:
    print(f"  ✓ all {len(data)} piece IDs are unique")
PYEOF

echo "▶ done — serve with: python3 -m http.server 8000"
