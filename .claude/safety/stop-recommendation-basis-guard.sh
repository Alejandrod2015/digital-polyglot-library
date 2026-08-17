#!/bin/bash
# Stop hook: RECOMMENDATION-BASIS GATE (2026-08-16)
#
# WHY: el 2026-08-16, diseñando el A1 España, recomendé un journey tipo
# "Expat" con una protagonista inventada. El usuario preguntó de dónde salía.
# De ningún sitio: era criterio mío. El dato real llevaba en la base desde el
# principio (BetaSignup.motivation del único usuario activo: "Holiday home in
# Spain and I wish to talk to neighbours"), y decía lo contrario. El usuario
# preguntó si le estaba saboteando.
#
# El fallo no fue recomendar sin dato: a veces no hay dato y hay que decidir
# igual. El fallo fue recomendar sin dato SIN DECIRLO, de forma que una
# corazonada mía llegó vestida de conclusión.
#
# WHAT IT DOES: lee el ÚLTIMO mensaje del asistente. Si contiene una
# recomendación y NO declara en qué se basa, BLOQUEA (exit 2).
#
# La declaración es una línea que empieza por `base:` y dice de dónde sale.
# Se admite explícitamente "base: ninguna" / "sin datos": si no hay dato, se
# dice, y el usuario juzga con esa etiqueta delante. Lo que no se admite es
# el silencio.
#
# NO hay variable de escape, igual que el guard de recomendación única.

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
    print("skip:unreadable"); sys.exit(0)

if not texts:
    print("skip:no_text"); sys.exit(0)

msg = texts[-1]
low = msg.lower()

# Lenguaje de recomendacion. Solo dispara cuando propongo un curso de accion,
# no cuando informo.
REC = [
    r"\bmi recomendaci[oó]n\b",
    r"\brecomiendo\b", r"\brecomendar[ií]a\b",
    r"\bsugiero\b", r"\bsugerir[ií]a\b",
    r"\bpropongo\b", r"\bpropondr[ií]a\b",
    r"\blo que har[ií]a\b", r"\byo ir[ií]a por\b",
    r"\bdeber[ií]amos\b", r"\bhabr[ií]a que\b",
    r"\bla mejor opci[oó]n es\b",
]
has_rec = any(re.search(p, low) for p in REC)
if not has_rec:
    print("ok:no_recommendation"); sys.exit(0)

# La declaracion de base: una linea que empiece por `base:` (admite negrita
# markdown y viñetas).
# OJO: `[ \t]*` y no `\s*`. Con `\s*` y re.M la coincidencia empieza en el
# salto de linea ANTERIOR, y al cortar por "\n" la linea sale vacia, asi que
# toda base valida se rechazaba por corta.
PREFIX = r"^[ \t]*(?:[-*][ \t]*)?(?:\*\*)?base(?:\*\*)?[ \t]*:"
BASIS = re.compile(PREFIX, re.I | re.M)
m = BASIS.search(msg)
if not m:
    print("BLOCK:missing"); sys.exit(0)

# Contenido de esa linea: no vale dejarla vacia.
line = msg[m.start():].split("\n", 1)[0]
body = re.sub(PREFIX, "", line, flags=re.I).strip()
body = body.strip("*_ ")
if len(body) < 12:
    print("BLOCK:empty"); sys.exit(0)

print("ok"); sys.exit(0)
')"

case "$RESULT" in
    BLOCK:missing)
        cat >&2 <<'EOF'
BLOQUEADO por la regla de base de la recomendación
(.claude/safety/stop-recommendation-basis-guard.sh).

Tu mensaje contiene una recomendación y no dice en qué se basa.

Añade una línea que empiece por `base:` y diga de dónde sale, en concreto:
  base: la motivación declarada de Vincent en BetaSignup, "Holiday home in
        Spain and I wish to talk to neighbours"
  base: las 13 duraciones reales del A0, 134 palabras por minuto
  base: ninguna, es criterio mío y no hay dato que lo respalde

La tercera es válida y a veces es la honesta. Lo que no vale es callarlo:
así fue como una corazonada ("journey tipo Expat") llegó vestida de
conclusión cuando el dato del usuario decía lo contrario.

Antes de escribirla, pregúntate si el dato existe y no lo has mirado.
`npx tsx scripts/userEvidence.ts <idioma>` vuelca lo que los usuarios
reales dijeron que quieren.
EOF
        exit 2
        ;;
    BLOCK:empty)
        cat >&2 <<'EOF'
BLOQUEADO: la línea `base:` está vacía o es demasiado corta para decir nada.

Di la fuente concreta: qué tabla, qué campo, qué medición, cuántos casos.
O di "ninguna, es criterio mío" si de verdad no hay dato detrás.
EOF
        exit 2
        ;;
    *)
        exit 0
        ;;
esac
