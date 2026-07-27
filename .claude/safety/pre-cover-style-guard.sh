#!/usr/bin/env bash
# PreToolUse guard: protects the LOCKED cover style.
#
# WHY: on 2026-07-26 Claude repeatedly changed scripts/cover-style.json on its
# own (flat-vector B -> cel-shaded C, adding/removing skin rules), wasting an
# hour of the user's time and generating covers in styles the user did not want.
# The style is the USER's decision. generateCover.ts is the ONLY sanctioned
# cover path (pre-bash-guard rule 5b blocks every other Flux path) and it ALWAYS
# prepends cover-style.json.styleBlock. THIS hook closes the last hole: Claude
# must NOT be able to edit cover-style.json (or disable this guard) on its own.
# Only the USER approves a style change, via an explicit phrase in their latest
# message. There is NO env-var bypass.
#
# Matches Edit/Write/MultiEdit (file_path) and Bash (command with a write op).

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

PROTECTED = ("scripts/cover-style.json", ".claude/safety/pre-cover-style-guard.sh")

def touches(s):
    s = s or ""
    return any(f in s for f in PROTECTED)

target = False
if tool in ("Edit", "Write", "MultiEdit"):
    target = touches(ti.get("file_path", ""))
elif tool == "Bash":
    cmd = ti.get("command", "")
    if touches(cmd) and re.search(r">>?|\btee\b|\bsed\b[^|]*-i|\bcp\b|\bmv\b|\bdd\b|\btruncate\b|\bln\b", cmd):
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

# The user must explicitly authorize a STYLE change: an approve/change verb next
# to a style noun (estilo / cover-style / portada).
has_verb = re.search(r"\b(aprueb[ao]|aprob(a|á|ar|ada)|cambi(a|á|ar|o|as|en)|nuev[oa]s?|actualiz(a|á|ar|o)|reemplaz(a|á|ar|o))\b", last, re.IGNORECASE)
has_noun = re.search(r"\b(estilo|cover[\s-]?style|portada|portadas|cover)\b", last, re.IGNORECASE)
neg = re.search(r"\b(no|nunca)\s+(cambi|aprueb|actualiz|reemplaz)", last, re.IGNORECASE)
if has_verb and has_noun and not neg:
    print("PASS")
else:
    print("BLOCK:no_style_approval")
PY
)"

if [ "${RESULT#BLOCK}" != "$RESULT" ]; then
  cat >&2 <<EOF
[cover-style-guard] BLOCKED: edit to the LOCKED cover style.

scripts/cover-style.json is the single source of truth for the approved cover
style (C - clean cel-shaded). Claude must NOT change it on its own; doing so is
exactly what wasted the user's time on 2026-07-26.

To change the style, the USER types an explicit phrase in their next message,
e.g.:  "aprueba el nuevo estilo"  /  "cambia el estilo de cover"  /  "nuevo estilo de portada".

Diagnostic: $RESULT
EOF
  exit 2
fi
exit 0
