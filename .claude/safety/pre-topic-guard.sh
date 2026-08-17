#!/usr/bin/env bash
# PreToolUse: ningún tema de journey se escribe sin pasar por el portón de
# evidencia (`assertTopicsGrounded`, src/lib/topicEvidence.ts).
#
# WHY (2026-08-17): cinco de los siete temas del A1 España salieron del molde
# de un curso de principiante en vez de las motivaciones reales de usuario.
# La regla vivía en memoria y se saltó sola.
#
# Solo gatea la ESCRITURA de temas. Leer y consultar pasa. No protege ficheros:
# si el portón cambia, se ve en el diff.

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
    r"topic\s*\.\s*(create|createMany|upsert|update|updateMany)"
    r"|insert\s+into\s+[\"`']?dp_topics_v1"
    r"|update\s+[\"`']?dp_topics_v1", re.I)

# El comando puede esconder la escritura dentro de un script; hay que leerlo.
hay = cmd
for m in re.finditer(r"(?:^|\s)((?:scripts|src)/[\w./-]+\.(?:ts|tsx|js|mjs))", cmd):
    try:
        hay += "\n" + open(m.group(1), encoding="utf-8", errors="ignore").read()
    except Exception:
        pass

print("PASS" if (not WRITE.search(hay)) or ("assertTopicsGrounded" in hay) else "BLOCK")
PY
)"

if [ "$RESULT" = "BLOCK" ]; then
  cat >&2 <<'MSG'
[topic-gate] BLOCKED: escritura de temas sin portón de evidencia.

Un tema nombra el dominio léxico de sus tres historias y sale de lo que la
gente ESCRIBIÓ, no del molde de un curso.

  1. npx tsx scripts/userEvidence.ts <idioma>
  2. Llama a `assertTopicsGrounded` pasando, por cada tema, la cita verbatim
     que lo justifica. Si la cita no está en BetaSignup, tira.
MSG
  exit 2
fi
exit 0
