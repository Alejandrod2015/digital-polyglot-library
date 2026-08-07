#!/bin/bash
# Hook PostToolUse: verifica el CONTRATO DE SONIDOS DE PRÁCTICA justo después
# de tocar cualquier fichero implicado.
#
# POR QUÉ ES PostToolUse Y NO PreToolUse. Los otros guards de este proyecto
# BLOQUEAN antes de actuar porque el daño es irreversible (un push, un correo,
# un secreto rotado). Aquí el daño es distinto: editar estos ficheros es
# legítimo y frecuente, y lo que hay que impedir no es el cambio sino que pase
# INADVERTIDO. Un PreToolUse que prohibiera tocarlos estorbaría cada día; este
# deja escribir, comprueba, y si el contrato se rompió devuelve el fallo con
# exit 2, que Claude Code entrega al modelo como corrección obligatoria.
#
# El caso real que lo motiva (2026-08-06/07): la app y la web acabaron con
# ficheros distintos bajo nombres casi iguales, y una precarga que funcionaba
# se desactivó por una hipótesis nunca comprobada. Nada de eso dio error: todo
# compilaba, todo "funcionaba", y el fallo solo existía en el oído del usuario,
# que lo reportó cuatro veces. Este hook convierte ese silencio en un error.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PAYLOAD="$(cat)"

# Ruta del fichero tocado, con o sin jq.
if command -v jq >/dev/null 2>&1; then
  TOUCHED="$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)"
else
  TOUCHED="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
fi

[ -z "$TOUCHED" ] && exit 0

# Solo los ficheros que forman parte del contrato.
case "$TOUCHED" in
  *apps/mobile/assets/sounds/*|\
  *public/sounds/*|\
  *apps/mobile/src/mobile/MobileLibraryShell.tsx|\
  *src/app/practice/page.tsx|\
  *scripts/checkPracticeAudio.ts) ;;
  *) exit 0 ;;
esac

OUT="$(cd "$REPO" && npx tsx scripts/checkPracticeAudio.ts 2>&1)"
STATUS=$?

if [ $STATUS -ne 0 ]; then
  {
    echo "$OUT"
    echo
    echo "Lo acabas de romper editando: $TOUCHED"
    echo "Estos cinco sonidos los eligió el usuario de oído y los confirmó"
    echo "sonando bien en iPhone y Pixel. No los cambies de lado; arregla la"
    echo "edición, o actualiza scripts/checkPracticeAudio.ts en el mismo"
    echo "cambio si la reasignación es deliberada."
  } >&2
  exit 2
fi

exit 0
