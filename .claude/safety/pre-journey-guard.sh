#!/usr/bin/env bash
# PreToolUse: ningún journey se CREA sin pasar por el portón de escalera
# (`assertLadderContiguous`, src/lib/journeyLadder.ts).
#
# WHY (2026-09-07): el B1 de portugués se abrió con el A2 sin existir y la
# escalera quedó con un hueco que nadie decidió a propósito. Regla del
# usuario, literal: "nunca se cree un journey si hay uno faltando de por
# medio. Tienes que prohibirlo."
#
# Solo gatea la CREACIÓN de journeys. Leer, consultar y actualizar pasa:
# el hueco se abre al crear, no al editar. No protege ficheros: si el portón
# cambia, se ve en el diff.

DPL_HOOK_PAYLOAD="$(cat)"; export DPL_HOOK_PAYLOAD
RESULT="$(/usr/bin/python3 - <<'PY'
import json, os, re
try:
    p = json.loads(os.environ.get("DPL_HOOK_PAYLOAD", ""))
except Exception:
    print("PASS"); raise SystemExit
if (p.get("tool_name") or "") != "Bash":
    print("PASS"); raise SystemExit
cmd = (p.get("tool_input") or {}).get("command", "") or ""

WRITE = re.compile(
    r"journey\s*\.\s*(create|createMany|upsert)"
    r"|insert\s+into\s+[\"']?dp_journeys_v1", re.I)

# El comando puede esconder la escritura dentro de un script; hay que leerlo.
hay = cmd
for m in re.finditer(r"(?:^|\s)((?:scripts|src)/[\w./-]+\.(?:ts|tsx|js|mjs))", cmd):
    try:
        hay += "\n" + open(m.group(1), encoding="utf-8", errors="ignore").read()
    except Exception:
        pass

print("PASS" if (not WRITE.search(hay)) or ("assertLadderContiguous" in hay) else "BLOCK")
PY
)"

if [ "$RESULT" = "BLOCK" ]; then
  cat >&2 <<'MSG'
[journey-ladder] BLOCKED: creación de journey sin portón de escalera.

Dentro de un (idioma, variante, tipo), los niveles tienen que quedar
CONTIGUOS: crear un B2 con el A2 sin existir deja un peldaño hueco y el
placement manda a la gente a un nivel que no es el suyo.

  Llama a `assertLadderContiguous` (src/lib/journeyLadder.ts) con el journey
  nuevo y los existentes live+draft ANTES de journey.create. Si deja hueco,
  tira: primero se rellena el peldaño que falta.
MSG
  exit 2
fi
exit 0
