#!/bin/bash
# uso: sc.sh <t> <slug> [--dry]   guarda el tema t del Friends DE A1 y, sin --dry, lo cierra
t=$1; slug=$2; D=/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/18a5cb21-72b9-47b8-b1f0-af076ac31a18/scratchpad; J=cmu0dqr6y0007j8o52i1s3gf7
npx tsx scripts/saveStory.ts scripts/_deA1Friends/t$t-data.json --journey $J --lang DE --level a1 --variant germany --narrator $3 > $D/s$t.txt 2>&1
grep -E "^=== FAIL|^   FAIL|^   warn|✗|CANDADO|saved" $D/s$t.txt | head -30
[ "$3" == "--dry" ] && { grep -q "All 3 stories pass" $D/s$t.txt && ! grep -q "GATE DE JOURNEY" $D/s$t.txt && echo "DRY OK"; exit 0; }
grep -q "saved" $D/s$t.txt || { echo "NO GUARDADO t$t"; exit 1; }
npx tsx scripts/cierraTema.ts $J $slug --plan scripts/_deA1Friends/t$t-plan.json > $D/c$t.txt 2>&1
if grep -q "EL TEMA NO SE CIERRA" $D/c$t.txt; then grep -A12 "EL TEMA NO SE CIERRA" $D/c$t.txt; exit 1; fi
grep -E "TEMA CERRADO|aviso|\[tics" $D/c$t.txt | head -12
