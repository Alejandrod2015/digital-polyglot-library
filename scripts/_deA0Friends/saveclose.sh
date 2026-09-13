#!/bin/bash
# uso: saveclose.sh <t> <slug>
t=$1; slug=$2
out=$(npx tsx scripts/saveStory.ts scripts/_deA0Friends/t$t-data.json --journey cmu047bkz0007326jsgeptkox --lang DE --level a0 --variant germany --narrator 2>&1)
echo "$out" | grep -E "FAIL|✗|✓ All|saved|CANDADO" | head -20
echo "$out" | grep -q "saved" || exit 1
c=$(npx tsx scripts/cierraTema.ts cmu047bkz0007326jsgeptkox $slug --plan scripts/_deA0Friends/t$t-plan.json 2>&1)
echo "$c" | grep -E "✓ TEMA" && exit 0
echo "$c" | grep -A10 "NO SE CIERRA"; exit 1
