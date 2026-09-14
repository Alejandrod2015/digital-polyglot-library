#!/bin/bash
t=$1; slug=$2; D=/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library--claude-worktrees-practical-austin-02dea1/5f242a7c-1aa5-49af-bb18-a4c7869ea28b/scratchpad
npx tsx scripts/saveStory.ts scripts/_deA0Friends/t$t-data.json --journey cmu047bkz0007326jsgeptkox --lang DE --level a0 --variant germany --narrator > $D/s$t.txt 2>&1
grep -E "^=== FAIL|^   FAIL|✗|CANDADO" $D/s$t.txt | head -10
grep -q "saved" $D/s$t.txt || { echo "NO GUARDADO t$t"; exit 1; }
npx tsx scripts/cierraTema.ts cmu047bkz0007326jsgeptkox $slug --plan scripts/_deA0Friends/t$t-plan.json > $D/c$t.txt 2>&1
if grep -q "EL TEMA NO SE CIERRA" $D/c$t.txt; then grep -A8 "EL TEMA NO SE CIERRA" $D/c$t.txt; exit 1; fi
grep -o "TEMA CERRADO.*hash [0-9a-f]*" $D/c$t.txt | head -1
