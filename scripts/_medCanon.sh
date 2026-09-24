#!/bin/bash
# Corre el validador canonico por historia (saveStory --dry) sobre cada draft.
set -u
mkdir -p /tmp/med
while IFS='|' read -r id lang level variant; do
  id=$(echo $id); lang=$(echo $lang); level=$(echo $level); variant=$(echo $variant)
  meta=$(npx tsx scripts/_medDump.ts "$id" "/tmp/med/$id.json" 2>&1 | tail -1)
  echo "##### $id $lang $level $variant :: $meta"
  npx tsx scripts/saveStory.ts "/tmp/med/$id.json" --journey "$id" --lang "$lang" --level "$level" --variant "$variant" --dry > "/tmp/med/$id.canon.txt" 2>&1
  tail -1 "/tmp/med/$id.canon.txt"
  grep -c "^=== FAIL" "/tmp/med/$id.canon.txt" | sed 's/^/  historias con FAIL: /'
  grep "^   FAIL \[" "/tmp/med/$id.canon.txt" | sed 's/\].*/]/' | sort | uniq -c | sort -rn | sed 's/^/  /'
done
