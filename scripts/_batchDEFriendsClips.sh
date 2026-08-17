#!/bin/bash
set -uo pipefail
cd "$(dirname "$0")/.."
LOG=scratchpad/de_friends_clips_batch.log
: > "$LOG"
DONE_SLUG="nadia-kriegt-eine-schnauze"  # ya hecho
while read -r slug; do
  [ -z "$slug" ] && continue
  [ "$slug" = "$DONE_SLUG" ] && { echo "SKIP (done) $slug" | tee -a "$LOG"; continue; }
  echo "=== RENDER $slug ===" | tee -a "$LOG"
  if npx tsx scripts/_genPracticeClips.ts "$slug" --lang=de >>"$LOG" 2>&1; then
    echo "=== SEED $slug ===" | tee -a "$LOG"
    npx tsx scripts/_seedAllSets.ts --only="$slug" --apply >>"$LOG" 2>&1 \
      && echo "OK $slug" | tee -a "$LOG" \
      || echo "SEED-FAIL $slug" | tee -a "$LOG"
  else
    echo "RENDER-FAIL $slug" | tee -a "$LOG"
  fi
done < /tmp/de_friends_slugs.txt
echo "=== BATCH DONE ===" | tee -a "$LOG"
