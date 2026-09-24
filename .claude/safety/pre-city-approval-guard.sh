#!/usr/bin/env bash
# PreToolUse guard: protege la lista de ciudades aprobadas.
#
# WHY: el 2026-09-24 el usuario puso como regla dura que la ciudad que enmarca
# un journey tiene que ser muy conocida FUERA de su pais, sobre todo por
# lectores anglosajones ("Las ciudades de los journeys tienen que ser ciudades
# muy conocidas fuera de esos paises, principalmente por nuestro grupo
# objetivo, anglosajones"). src/lib/approvedCities.ts es la lista contra la que
# comprueba el gate de temas. Este hook cierra la otra mitad: Claude NO puede
# anadir una ciudad a esa lista (ni desactivar este guard) por su cuenta. Es
# exactamente el fallo que tuvo la lista de voces antes de tener su propio
# hook, el 2026-07-19.
#
# Solo el USUARIO aprueba una ciudad, con una frase explicita en su mensaje
# mas reciente. NO hay escape por variable de entorno.
#
# Matchea Edit/Write/MultiEdit (file_path) y Bash (command).

DPL_HOOK_PAYLOAD="$(cat)"
export DPL_HOOK_PAYLOAD

RESULT="$(/usr/bin/python3 - <<'PY'
import json, os, re

raw = os.environ.get("DPL_HOOK_PAYLOAD", "")
try:
    p = json.loads(raw)
except Exception:
    print("PASS"); raise SystemExit

tool = p.get("tool_name") or ""
ti = p.get("tool_input") or {}

PROTECTED = ("src/lib/approvedCities.ts", ".claude/safety/pre-city-approval-guard.sh")

def touches_protected(s):
    s = s or ""
    return any(f in s for f in PROTECTED)

target = False
if tool in ("Edit", "Write", "MultiEdit"):
    target = touches_protected(ti.get("file_path", ""))
elif tool == "Bash":
    cmd = ti.get("command", "")
    if touches_protected(cmd) and re.search(r">>?|\btee\b|\bsed\b[^|]*-i|\bcp\b|\bmv\b|\bdd\b|\btruncate\b|\bln\b", cmd):
        target = True

if not target:
    print("PASS"); raise SystemExit

tp = p.get("transcript_path") or ""
if not tp or not os.path.exists(tp):
    print("BLOCK:no_transcript"); raise SystemExit

msgs = []
try:
    with open(tp) as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if obj.get("type") != "user":
                continue
            c = obj.get("message", {}).get("content", "")
            if isinstance(c, str):
                msgs.append(c)
            elif isinstance(c, list):
                for part in c:
                    if isinstance(part, dict) and part.get("type") == "text":
                        msgs.append(part.get("text", ""))
except Exception:
    print("BLOCK:read_error"); raise SystemExit

if not msgs:
    print("BLOCK:no_user_messages"); raise SystemExit

last = msgs[-1] or ""
last = re.sub(r"<system-reminder>.*?</system-reminder>", "", last, flags=re.DOTALL | re.IGNORECASE)
last = re.sub(r"<task-notification>.*?</task-notification>", "", last, flags=re.DOTALL | re.IGNORECASE)

has_verb = re.search(r"\b(aprueb[ao]|aprob(a|á|ar|ada|adas|ados|o))\b", last, re.IGNORECASE)
has_city = re.search(r"\bciudad(es)?\b", last, re.IGNORECASE)
neg = re.search(r"\b(no|nunca)\s+(aprueb|aprob)", last, re.IGNORECASE)
if has_verb and has_city and not neg:
    print("PASS")
else:
    print("BLOCK:no_approval_verb")
PY
)"

if [ "${RESULT#BLOCK}" != "$RESULT" ]; then
  cat >&2 <<EOF
[city-approval-guard] BLOQUEADO: edicion de la lista de ciudades aprobadas.

src/lib/approvedCities.ts dice que ciudades pueden enmarcar un journey. La
regla dura: tienen que ser muy conocidas FUERA de su pais, sobre todo por
lectores anglosajones. Claude NO amplia esa lista por su cuenta.

Para aprobar, el usuario lo dice en su siguiente mensaje, por ejemplo:
  "aprueba la ciudad <nombre>"  /  "apruebo esa ciudad"  /  "ciudad aprobada".

Diagnostico: $RESULT
EOF
  exit 2
fi
exit 0
