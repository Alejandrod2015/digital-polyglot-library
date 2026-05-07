#!/usr/bin/env bash
# Downloads curated Piper voices (~400 MB total) into scripts/tts/piper-voices/
# Idempotent — skips files that already exist. Re-run any time to refresh.
set -euo pipefail

cd "$(dirname "$0")"
DEST="piper-voices"
mkdir -p "$DEST"

VOICES=(
  # User-approved voices only. Other Piper voices were tested and rejected.
  "es/es_ES/sharvard/medium/es_ES-sharvard-medium"
  "pt/pt_BR/cadu/medium/pt_BR-cadu-medium"
  "it/it_IT/paola/medium/it_IT-paola-medium"
  # Candidates for testing (LATAM Spanish, neutral-MX accent).
  "es/es_MX/claude/high/es_MX-claude-high"
  "es/es_MX/ald/medium/es_MX-ald-medium"
)

BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"

for path in "${VOICES[@]}"; do
  name="$(basename "$path")"
  for ext in onnx onnx.json; do
    out="$DEST/${name}.${ext}"
    if [ -s "$out" ]; then
      echo "✓ $out (cached)"
      continue
    fi
    echo "↓ $out"
    curl -sSL -o "$out" "$BASE/$path.$ext"
  done
done

echo
du -sh "$DEST"
