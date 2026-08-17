#!/bin/bash
set -uo pipefail
cd "$(dirname "$0")/.."
LOG=scratchpad/de_friends_words_batch.log
: > "$LOG"
while read -r slug; do
  [ -z "$slug" ] && continue
  echo "=== $slug ===" | tee -a "$LOG"
  npx tsx scripts/_genWordClips.ts "$slug" >>"$LOG" 2>&1 && echo "OK $slug" | tee -a "$LOG" || echo "FAIL $slug" | tee -a "$LOG"
done < /tmp/de_friends_slugs.txt
echo "=== BATCH DONE ===" | tee -a "$LOG"
