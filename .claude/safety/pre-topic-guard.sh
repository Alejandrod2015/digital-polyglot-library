#!/usr/bin/env bash
# PreToolUse: AVISA (no bloquea) cuando se escriben temas de journey sin pasar
# por el informe de pistas (`assertTopicsGrounded`, src/lib/topicEvidence.ts).
#
# WHY (2026-09-15, decision del usuario, literal): "La motivación de unos
# cuántos beta testers no puede ser un filtro, solo una pista." Hasta ese dia
# este hook BLOQUEABA toda escritura de temas que no llamara al porton de
# evidencia. Ahora las motivaciones inspiran temas y no los vetan: el hook solo
# recuerda que el informe existe. Salida siempre 0.
#
# Origen (2026-08-17): cinco de los siete temas del A1 España salieron del molde
# de un curso de principiante. El informe sigue sirviendo para verlo.
#
# Solo mira la ESCRITURA de temas. Leer y consultar pasa sin aviso.

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

print("PASS" if (not WRITE.search(hay)) or ("assertTopicsGrounded" in hay) else "WARN")
PY
)"

if [ "$RESULT" = "WARN" ]; then
  MSG='[topic-hint] AVISO, no bloquea: escritura de temas sin el informe de pistas (assertTopicsGrounded). Las motivaciones beta son pista, no filtro (2026-09-15). Si quieres verlas: npx tsx scripts/userEvidence.ts <idioma>. Las reglas de NOMBRE de temas siguen valiendo y assertTopicsGrounded las comprueba.'
  DPL_MSG="$MSG" /usr/bin/python3 -c 'import json,os; m=os.environ["DPL_MSG"]; print(json.dumps({"systemMessage": m, "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": m}}))'
fi
exit 0
