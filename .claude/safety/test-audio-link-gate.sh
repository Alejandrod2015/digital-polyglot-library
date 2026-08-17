#!/bin/bash
# Casos del gate "el audio de una historia se oye en la historia".
# 0 = deja cerrar, 2 = bloquea el cierre.
cd /Users/alejandrodelcarpio/digital-polyglot-library || exit 1
G=.claude/safety/stop-story-audio-link-guard.sh
T=$(mktemp -d)
R2=https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev
fails=0

t() { # t <texto del mensaje> <esperado> <descripción>
  local tr="$T/t.jsonl" rc
  python3 -c '
import json,sys
open(sys.argv[1],"w").write(json.dumps({"type":"assistant","message":{"content":[{"type":"text","text":sys.argv[2]}]}})+"\n")
' "$tr" "$1"
  printf '{"transcript_path":"%s"}' "$tr" | bash "$G" >/dev/null 2>&1
  rc=$?
  if [ "$rc" = "$2" ]; then printf 'ok    %s\n' "$3"; else printf 'FALLO %s (esperado %s, dio %s)\n' "$3" "$2" "$rc"; fails=$((fails+1)); fi
}

t "Listo, sin audio ninguno." 0 "mensaje sin audio"
t "Oye [el master]($R2/media/generated/audio/Um_balde_multivoice_1.mp3) en 0:11." 2 "master suelto, sin lector"
t "Oye [Um balde](http://localhost:3000/stories/um-balde-uma-onda) en 0:11." 0 "solo enlace de lector"
t "[historia](http://localhost:3000/stories/um-balde-uma-onda) master de rollback: $R2/media/generated/audio/Um_balde_multivoice_1.mp3" 0 "master citado junto a su lector"
t "Dos: $R2/media/generated/audio/A_multivoice_1.mp3 y $R2/media/generated/audio/B_multivoice_2.mp3 ; [una](http://localhost:3000/stories/a-uno)" 2 "dos masters, un solo lector"
t "Dos: $R2/media/generated/audio/A_multivoice_1.mp3 [a](http://localhost:3000/stories/a-uno) $R2/media/generated/audio/B_multivoice_2.mp3 [b](http://localhost:3000/stories/b-dos)" 0 "dos masters, dos lectores"
t "Fragmento: $R2/media/multivoice-segments/abc123.mp3" 2 "fragmento suelto tambien cuenta"
t "Muestra de voz: $R2/media/review/sample-voz-1.mp3" 0 "muestra de voz suelta: exenta"
t "La pagina de audicion: $R2/media/review/voces.html" 0 "pagina de review: exenta"

# stop_hook_active nunca debe re-bloquear (evita el bucle).
python3 -c '
import json,sys
open(sys.argv[1],"w").write(json.dumps({"type":"assistant","message":{"content":[{"type":"text","text":sys.argv[2]}]}})+"\n")
' "$T/t.jsonl" "$R2/media/generated/audio/X_multivoice_1.mp3"
printf '{"transcript_path":"%s","stop_hook_active":true}' "$T/t.jsonl" | bash "$G" >/dev/null 2>&1
[ $? = 0 ] && echo "ok    stop_hook_active no re-bloquea" || { echo "FALLO stop_hook_active re-bloquea"; fails=$((fails+1)); }

rm -rf "$T"
[ "$fails" = 0 ] && echo "TODO OK" || echo "$fails fallos"
exit "$fails"
