#!/bin/bash
# Hook PostToolUse: tras GUARDAR una historia, comprueba que su lookup sigue
# cubriendo cada palabra tocable. Si no, devuelve exit 2 con el arreglo.
#
# POR QUÉ AQUÍ Y NO EN UN CHEQUEO DE FECHAS. La primera idea fue comparar la
# fecha del bundle contra la de sus historias, y es peor: una edición que no
# introduce palabras nuevas no rompe nada, y una que sí las introduce rompe
# aunque el bundle sea posterior si se generó mirando sólo el cuerpo. La fecha
# es un proxy; lo que importa es la COBERTURA, y eso es lo que mide
# `rebuildTapGlosses.ts --check`.
#
# POR QUÉ TRAS GUARDAR Y NO ANTES. El daño no es irreversible ni sale hacia
# fuera: editar historias es el trabajo normal. Lo que hay que impedir es que
# la edición deje palabras muertas SIN QUE NADIE SE ENTERE. Bloquear antes
# estorbaría cada día; comprobar después convierte un fallo silencioso en un
# error inmediato.
#
# El caso real (2026-08-07): el usuario tocó `kündigt` y no salió nada. Al
# medirlo, `spanish-traveler-mexico-a0` llevaba desde el 21 de julio con UNA DE
# CADA OCHO palabras muerta en sus 21 historias, con casos del 23%. Compilaba,
# publicaba, y el único que podía enterarse era el usuario tocando una palabra.
#
# LÍMITE CONOCIDO, dicho aquí para que nadie lo dé por cubierto: esto sólo ve
# lo que pasa por un comando de Bash. Una historia editada desde el Studio (la
# web) no dispara ningún hook. Para eso hay que correr el check a mano:
#   npx tsx scripts/rebuildTapGlosses.ts --check
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PAYLOAD="$(cat)"

if command -v jq >/dev/null 2>&1; then
  CMD="$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // empty' 2>/dev/null)"
else
  CMD="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1)"
fi

[ -z "$CMD" ] && exit 0

# Sólo tras ESCRIBIR historias. `--dry` valida sin guardar, así que no cuenta;
# tampoco leer o grepear el saver.
case "$CMD" in
  *saveStory.ts*|*rebuildTapGlosses.ts*) ;;
  *) exit 0 ;;
esac
case "$CMD" in
  *--dry*) exit 0 ;;
esac
# Leer el saver no es guardar. La lista se quedo corta el 2026-08-26: un
# `sed -n '1,80p' scripts/saveStory.ts` disparaba la auditoria entera y
# bloqueaba, con lo que abrir el fichero para mirarlo costaba un exit 2.
case "$CMD" in
  grep*|*"| grep"*|rg\ *|cat\ *|less\ *|head\ *|tail\ *|sed\ *|awk\ *|wc\ *|diff\ *) exit 0 ;;
esac

OUT="$(cd "$REPO" && npx tsx scripts/rebuildTapGlosses.ts --check 2>&1)"
STATUS=$?

if [ $STATUS -ne 0 ]; then
  {
    echo "$OUT"
    echo
    echo "Disparado tras: $CMD"
  } >&2
  exit 2
fi

exit 0
