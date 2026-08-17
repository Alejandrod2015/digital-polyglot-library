#!/bin/bash
set -uo pipefail
cd "$(dirname "$0")/.."
LOG=scratchpad/latam_friends_clips_batch.log
: > "$LOG"
while read -r slug; do
  [ -z "$slug" ] && continue
  echo "=== RENDER $slug ===" | tee -a "$LOG"
  if npx tsx scripts/_genPracticeClips.ts "$slug" >>"$LOG" 2>&1; then
    npx tsx scripts/_seedAllSets.ts --only="$slug" --apply >>"$LOG" 2>&1 \
      && echo "OK $slug" | tee -a "$LOG" \
      || echo "SEED-FAIL $slug" | tee -a "$LOG"
  else
    echo "RENDER-FAIL $slug" | tee -a "$LOG"
  fi
done < /tmp/latam_friends_slugs.txt
echo "=== BATCH DONE ===" | tee -a "$LOG"
