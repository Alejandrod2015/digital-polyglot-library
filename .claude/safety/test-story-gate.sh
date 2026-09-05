#!/bin/bash
# Casos del gate de historias: 0 = pasa, 2 = bloquea.
cd /Users/alejandrodelcarpio/digital-polyglot-library || exit 1
G=.claude/safety/pre-story-save-guard.sh
C='journeyStory'
fails=0

t() { # t <comando> <esperado> <descripción>
  local out rc
  out="$(printf '{"tool_input":{"command":%s}}' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")" | bash "$G" 2>&1)"
  rc=$?
  if [ "$rc" = "$2" ]; then printf 'ok    %s\n' "$3"; else printf 'FALLO %s (esperado %s, dio %s)\n' "$3" "$2" "$rc"; fails=$((fails+1)); fi
}

printf 'await prisma.%s.update({ where: { id }, data: { text: "cuerpo nuevo", vocab: [] } });\n' "$C" > scripts/_gtest_content.ts
printf 'await prisma.%s.update({ where: { id }, data: { audioFragments: f, ...(x ? { text: y } : {}) } });\n' "$C" > scripts/_gtest_spread.ts
{ printf 'const d: any = {};\n'; printf 'd[\x27text\x27] = "cuerpo camuflado";\n'; printf 'await prisma.%s.update({ where: { id }, data: d });\n' "$C"; } > scripts/_gtest_dyn.ts

t "npx tsx scripts/backfillAudioSections.ts o-acaraje-de-celia" 0 "backfillAudioSections: solo audioFragments"
t "npx tsx scripts/_remeasureFragments.ts slug --apply"          0 "_remeasureFragments: solo audioFragments"
t "npx tsx scripts/saveStory.ts d.json --journey x"              0 "saveStory: el saver sancionado"
t "npx tsx scripts/_gtest_content.ts"                            2 "text/vocab de primer nivel"
t "npx tsx scripts/_gtest_spread.ts"                             2 "spread opaco junto a audioFragments"
t "npx tsx scripts/_gtest_dyn.ts"                                2 "camuflaje por corchete: d[text] = ..."
t "npx tsx scripts/journeysTable.ts"                             0 "script de solo lectura"
t "grep -n text scripts/saveStory.ts"                            0 "leer un saver no ejecuta nada"
t "node -e \"await p.${C}.update({where:{id},data:{text:'x'}})\"" 2 "inline con text"
t "node -e \"await p.${C}.update({where:{id},data:{audioUrl:u}})\"" 0 "inline solo audioUrl"

rm -f scripts/_gtest_content.ts scripts/_gtest_spread.ts scripts/_gtest_dyn.ts
[ "$fails" = 0 ] && echo "TODO OK" || echo "$fails fallos"
exit "$fails"
