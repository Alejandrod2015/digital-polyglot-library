#!/bin/bash
# Stop hook: SINGLE-RECOMMENDATION GATE (2026-08-03)
#
# WHY: the user's standing rule is "no me des opciones, dame una
# recomendación única". It kept being broken the same way: the body of the
# answer DOES commit to a position ("me inclino por lo primero") and then the
# closing line dissolves it into a menu ("¿Cuál?" / "¿opción 1 o la 2?").
# Memory/instructions alone did not hold, so this enforces it mechanically.
#
# WHAT IT DOES: reads the LAST assistant message from the transcript and
# BLOCKS the stop (exit 2) when its CLOSING presents a choice between
# alternatives. stderr is fed back to Claude, which must rewrite the ending.
#
# ALLOWED (does not block):
#   - a single yes/no on one recommendation:  "¿Lo hago?"
#   - no question at all
#   - the AskUserQuestion tool (structured choice, not prose)
# BLOCKED:
#   - "¿Cuál prefieres?" / "¿la 1 o la 2?" / "tú decides" / "elige"
#   - any closing question whose alternatives are joined by " o "
#
# NO bypass env var, by design. If a genuine either/or is needed, use the
# AskUserQuestion tool instead of a prose menu.

set -uo pipefail
PAYLOAD="$(cat)"

RESULT="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
import json, sys, os, re

try:
    payload = json.load(sys.stdin)
except Exception:
    print("skip:no_payload"); sys.exit(0)

# Never re-block a stop we already blocked: prevents an infinite loop.
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

# Only the CLOSING matters: the body is allowed (and encouraged) to lay out
# trade-offs. The rule is about how the message ENDS.
tail = msg[-500:]

# Last question in the tail, if any.
qs = re.findall(r"[^.!?\n]*\?", tail)
if not qs:
    print("ok:no_question"); sys.exit(0)
q = qs[-1].strip()
ql = q.lower()

MENU = [
    r"\bcu[aá]l\b", r"\bcu[aá]les\b", r"\bqu[eé]\s+prefieres\b", r"\bprefieres\b",
    r"\belige\b", r"\belijes\b", r"\bescoge\b", r"\bt[uú]\s+decides\b",
    r"\bqu[eé]\s+opci[oó]n\b", r"\bopci[oó]n\s*[ab12]\b", r"\bla\s*[12]\s*o\s*la\s*[12]\b",
    r"\bwhich\b", r"\bprefer\b",
]
for pat in MENU:
    if re.search(pat, ql):
        print("BLOCK:" + q[:180]); sys.exit(0)

# Alternatives joined by " o " inside the closing question, e.g.
# "¿lo hago ahora o espero?" -> that is a menu, not a yes/no.
core = re.sub(r"^[¿\s]+", "", ql)
if re.search(r"\s+o\s+", core) and len(core.split()) >= 5:
    print("BLOCK:" + q[:180]); sys.exit(0)

print("ok"); sys.exit(0)
')"

case "$RESULT" in
    BLOCK:*)
        cat >&2 <<EOF
BLOQUEADO por la regla de recomendación única (.claude/safety/stop-single-rec-guard.sh).

Tu mensaje termina ofreciendo un menú en vez de una recomendación:
  "${RESULT#BLOCK:}"

El usuario tiene una regla dura: NO ofrecer alternativas, dar UNA
recomendación y sostenerla. Reescribe el cierre así:
  - elige la opción que recomiendas y dila como decisión, no como pregunta;
  - si de verdad necesitas confirmación, que sea SÍ/NO sobre esa única
    opción ("¿Lo hago?"), nunca "¿esta o la otra?";
  - si el usuario tiene que decidir entre alternativas de verdad
    equivalentes, usa la herramienta AskUserQuestion, no prosa.
EOF
        exit 2
        ;;
    *)
        exit 0
        ;;
esac
