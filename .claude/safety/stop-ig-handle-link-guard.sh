#!/bin/bash
# Stop hook: HANDLES DE INSTAGRAM ENLAZADOS (2026-09-10)
#
# WHY: el 2026-09-09 el usuario pidio que toda cuenta de Instagram que se
# nombre en el chat vaya como enlace clicable, [@handle](https://www.instagram.com/handle/),
# porque trabaja la estrategia de comentarios abriendo las cuentas una por una
# desde el mensaje. La regla vivia solo en memoria
# (feedback_link_instagram_handles) y sin gate; una regla sin gate no es una
# regla, asi que se mide.
#
# QUE MIDE: el ultimo mensaje del asistente, sin bloques de codigo, sin codigo
# en linea y sin los enlaces markdown ya formados. Si queda un @handle suelto,
# bloquea y lista cuales. No cuenta como handle: un correo (hay una letra antes
# de la arroba) ni un paquete (@scope/nombre, lleva barra detras).
#
# Sin variable de escape, igual que los otros guards de cierre.

set -uo pipefail
PAYLOAD="$(cat)"

RESULT="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
import json, sys, os, re

try:
    payload = json.load(sys.stdin)
except Exception:
    print("skip:no_payload"); sys.exit(0)

if payload.get("stop_hook_active"):
    print("skip:already_active"); sys.exit(0)

tp = payload.get("transcript_path") or ""
if not tp or not os.path.exists(tp):
    print("skip:no_transcript"); sys.exit(0)

texts = []
try:
    with open(tp) as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if obj.get("type") != "assistant":
                continue
            content = obj.get("message", {}).get("content", "")
            if isinstance(content, str):
                texts.append(content)
            elif isinstance(content, list):
                buf = [p.get("text", "") for p in content
                       if isinstance(p, dict) and p.get("type") == "text"]
                if buf:
                    texts.append("\n".join(buf))
except Exception:
    print("skip:read_error"); sys.exit(0)

if not texts:
    print("skip:no_assistant_msg"); sys.exit(0)

msg = texts[-1] or ""
msg = re.sub(r"```.*?```", " ", msg, flags=re.S)      # bloques de codigo
msg = re.sub(r"`[^`\n]*`", " ", msg)                   # codigo en linea
msg = re.sub(r"\[[^\]]*\]\([^)]*\)", " ", msg)         # enlaces ya formados

sueltos = []
for m in re.finditer(r"(?<![\w.@/])@([A-Za-z0-9._]{2,30})(?![\w/@])", msg):
    h = m.group(1).rstrip(".")
    if h and h not in sueltos:
        sueltos.append(h)

if sueltos:
    print("block:" + " ".join("@" + h for h in sueltos[:12])); sys.exit(0)
print("ok"); sys.exit(0)
' 2>/dev/null)"

case "${RESULT:-}" in
  block:*)
    LISTA="${RESULT#block:}"
    cat >&2 <<EOF
BLOQUEADO: handles de Instagram sin enlazar
(.claude/safety/stop-ig-handle-link-guard.sh).

Sueltos en tu mensaje: ${LISTA}

Toda cuenta de Instagram va como enlace clicable:
  [@handle](https://www.instagram.com/handle/)
tambien en tablas, listas y de pasada en una frase. Reescribe el mensaje con
los enlaces.

WHY: el usuario abre las cuentas una por una desde el mensaje; un handle en
texto plano le obliga a copiarlo y buscarlo a mano (feedback_link_instagram_handles).
EOF
    exit 2
    ;;
esac

exit 0
