#!/bin/bash
# Stop hook: PRESUPUESTO DE PALABRAS (2026-08-18)
#
# WHY: la regla "responde corto por defecto" llevaba tiempo en memoria y se
# rompía siempre igual. El 2026-08-18 el usuario contó a mano un par de
# mensajes míos: 311 palabras para decir "dos arregladas, una no, la rehago".
# Su reacción: "quiero que agregues una regla a todo el proyecto para que
# nunca más haya una exageración de palabras como esa para responder algo
# sencillo". Una regla sin gate no es una regla, así que se mide.
#
# QUÉ MIDE: solo la PROSA del último mensaje del asistente. No cuentan las
# tablas, los bloques de código, las listas de enlaces ni las líneas
# `verified:` / `not verified:` / `base:`, que son obligatorias por otras
# reglas y no son palabrería. Un informe con tabla puede ser largo; el texto
# corrido alrededor, no.
#
# TOPE: 160 palabras de prosa. La salida es reescribir, no partir el mensaje
# en dos: lo que sobra casi siempre es recapitular lo ya dicho, explicar el
# razonamiento que nadie pidió y repetir la conclusión al final.
#
# Sin variable de escape, igual que los otros dos guards de cierre. Si de
# verdad hace falta extensión, va en una tabla o en un archivo entregado.

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

msg = (texts[-1] or "").strip()
if not msg:
    print("skip:empty"); sys.exit(0)

# Fuera los bloques de código enteros.
msg = re.sub(r"```.*?```", " ", msg, flags=re.S)

prosa = []
for linea in msg.split("\n"):
    l = linea.strip()
    if not l:
        continue
    if l.startswith("|"):          # tabla
        continue
    if re.match(r"^[-*]\s*\[", l):  # lista de enlaces
        continue
    if re.match(r"^(verified|not verified|base)\s*:", l, re.I):
        continue
    if re.match(r"^`?verified", l, re.I) or re.match(r"^`?not verified", l, re.I):
        continue
    prosa.append(l)

texto = " ".join(prosa)
texto = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", texto)   # enlaces -> su texto
texto = re.sub(r"[`*_#>]", " ", texto)
palabras = [p for p in re.split(r"\s+", texto) if re.search(r"[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]", p)]
n = len(palabras)

TOPE = 160
if n > TOPE:
    print("block:%d" % n); sys.exit(0)
print("ok:%d" % n); sys.exit(0)
' 2>/dev/null)"

case "${RESULT:-}" in
  block:*)
    N="${RESULT#block:}"
    cat >&2 <<EOF
BLOQUEADO por el presupuesto de palabras
(.claude/safety/stop-word-budget-guard.sh).

Tu mensaje tiene ${N} palabras de prosa; el tope son 160.

No lo partas en dos mensajes: reescríbelo. Lo que sobra casi siempre es
una de estas tres cosas:

  1. Recapitular lo que ya está dicho más arriba o lo que el usuario
     acaba de leer en la salida de un comando.
  2. Explicar el razonamiento que nadie pidió. Da la conclusión; si
     quieren el porqué, lo preguntan.
  3. Repetir la conclusión al final con otras palabras.

No cuentan para el tope las tablas, los bloques de código, las listas de
enlaces ni las líneas verified / not verified / base. Si de verdad hace
falta extensión, ponla en una tabla o en un archivo, no en texto corrido.

WHY: el 2026-08-18 el usuario contó 311 palabras en dos mensajes que
decían "dos arregladas, una no, la rehago".
EOF
    exit 2
    ;;
esac

exit 0
