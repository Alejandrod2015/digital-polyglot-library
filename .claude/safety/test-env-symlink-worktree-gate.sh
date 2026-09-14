#!/bin/bash
# Prueba la regla 2 (ln -f sobre .env via ../../../) del guard:
#   - dentro de un worktree real (.claude/worktrees/<name>/): bloquea sin
#     autorizacion, pasa con ella.
#   - fuera de un worktree: bloquea siempre, con y sin autorizacion.
#   - una ruta ../../../ que aparenta salir del repo tambien se prueba.
#
# No crea ni toca ningun .env real: el guard solo lee el texto del comando y
# el directorio efectivo (via `cd` real a directorios vacios de prueba), no
# escribe symlinks. Ejecuta el guard en modo dry (el comando bloqueado nunca
# se corre de verdad, solo se le pasa al hook por stdin).
set -u
G="/Users/alejandrodelcarpio/digital-polyglot-library/.claude/safety/pre-bash-guard.sh"
REPO_ROOT="/Users/alejandrodelcarpio/digital-polyglot-library"
fails=0

run_guard() { # run_guard <command> <cwd>
  local cmd="$1" cwd="$2" rc
  ( cd "$cwd" 2>/dev/null && printf '{"tool_input":{"command":%s},"transcript_path":"/tmp/no-existe.jsonl"}' \
      "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$cmd")" | bash "$G" >/tmp/_guard_out.$$ 2>&1 )
  rc=$?
  cat /tmp/_guard_out.$$ >/tmp/_guard_last.$$
  rm -f /tmp/_guard_out.$$
  return "$rc"
}

t() { # t <descripcion> <comando> <cwd> <esperado 0|2>
  local desc="$1" cmd="$2" cwd="$3" expected="$4" rc
  run_guard "$cmd" "$cwd"
  rc=$?
  if [ "$rc" = "$expected" ]; then
    printf 'ok    %s\n' "$desc"
  else
    printf 'FALLO %s (esperado %s, dio %s)\n' "$desc" "$expected" "$rc"
    fails=$((fails + 1))
  fi
}

# --- Fixtures: un "worktree" y un directorio normal, sin tocar el real ------
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_ROOT"' EXIT

# Simula .claude/worktrees/<name>/ DENTRO del repo real (para que el path
# empiece por "$REPO_ROOT/.claude/worktrees/", que es lo que mira el guard),
# pero como carpeta descartable fuera de git (prefijo _test_ para no chocar
# con nada y para poder limpiarla sin riesgo).
WT_NAME="_test_fixture_$$"
WT_DIR="$REPO_ROOT/.claude/worktrees/$WT_NAME"
mkdir -p "$WT_DIR"
trap 'rm -rf "$FIXTURE_ROOT" "$WT_DIR"' EXIT

# Directorio normal fuera de cualquier worktree.
OUTSIDE_DIR="$FIXTURE_ROOT/not-a-worktree"
mkdir -p "$OUTSIDE_DIR"

LN_CMD="ln -sf ../../../.env .env"

echo "== Dentro de un worktree =="
t "sin autorizacion -> bloquea (pide confirmar)" "$LN_CMD" "$WT_DIR" 2
t "con CLAUDE_AUTHORIZED=1 -> pasa"              "CLAUDE_AUTHORIZED=1 $LN_CMD" "$WT_DIR" 0
t "cd al worktree + ln, sin autorizacion -> bloquea" "cd $WT_DIR && $LN_CMD" "$REPO_ROOT" 2
t "cd al worktree + ln, con autorizacion -> pasa"    "cd $WT_DIR && CLAUDE_AUTHORIZED=1 $LN_CMD" "$REPO_ROOT" 0

echo "== Fuera de un worktree =="
t "sin autorizacion -> bloquea"           "$LN_CMD" "$OUTSIDE_DIR" 2
t "CON autorizacion -> sigue bloqueando"  "CLAUDE_AUTHORIZED=1 $LN_CMD" "$OUTSIDE_DIR" 2
t "en el propio repo root -> bloquea"     "$LN_CMD" "$REPO_ROOT" 2
t "cd fuera de worktree + ln -> bloquea"  "cd $OUTSIDE_DIR && $LN_CMD" "$REPO_ROOT" 2

echo "== El texto del comando no basta, decide el directorio efectivo =="
# El patron de "../../../.env" reconoce por texto cualquier cadena de 3 o mas
# "../" seguida de ".env" (no ancla el inicio), asi que un ln con MAS niveles
# tambien cae bajo la regla: lo que decide autorizado/bloqueado sigue siendo
# el directorio efectivo, no el numero exacto de "../".
t "4 niveles arriba, pero DENTRO del worktree -> igual pide autorizacion" \
  "ln -sf ../../../../.env .env" "$WT_DIR" 2
t "4 niveles arriba, pero DENTRO del worktree + autorizado -> pasa" \
  "CLAUDE_AUTHORIZED=1 ln -sf ../../../../.env .env" "$WT_DIR" 0
t "4 niveles arriba, FUERA del worktree -> bloquea igual (con o sin CLAUDE_AUTHORIZED)" \
  "CLAUDE_AUTHORIZED=1 ln -sf ../../../../.env .env" "$OUTSIDE_DIR" 2

echo
if [ "$fails" = 0 ]; then
  echo "TODO OK"
else
  echo "$fails fallos"
fi
exit "$fails"
