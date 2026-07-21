#!/usr/bin/env bash
# PreToolUse guard: protects the approved-voices allowlist.
#
# WHY: on 2026-07-19 Claude rendered a story with a voice the user never
# approved. The runtime gate (src/lib/approvedVoices.ts assertVoiceApproved)
# makes it impossible to synthesize production audio with a voiceId that is
# not on the allowlist. THIS hook closes the other half: Claude must not be
# able to ADD a voice to that allowlist (or disable this guard) on its own.
# Only the USER approves voices — signalled by an explicit approval phrase in
# their most recent chat message.
#
# Matches Edit/Write/MultiEdit (file_path) and Bash (command). Blocks any
# write to the protected files unless the user's latest message contains an
# approval verb. There is NO env-var bypass.

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

PROTECTED = ("src/lib/approvedVoices.ts", ".claude/safety/pre-voice-approval-guard.sh")

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
has_voz = re.search(r"\bvo(z|ces)\b", last, re.IGNORECASE)
neg = re.search(r"\b(no|nunca)\s+(aprueb|aprob)", last, re.IGNORECASE)
if has_verb and has_voz and not neg:
    print("PASS")
else:
    print("BLOCK:no_approval_verb")
PY
)"

if [ "${RESULT#BLOCK}" != "$RESULT" ]; then
  cat >&2 <<EOF
[voice-approval-guard] BLOCKED: edit to the approved-voices allowlist.

src/lib/approvedVoices.ts is the single source of truth for which ElevenLabs
voices may render PRODUCTION audio. Claude must NOT add a voice on its own.
Only the USER approves a voice, after auditioning it by ear.

To approve, the user types an explicit approval phrase in their next message,
e.g.:  "aprueba la voz <name/id>"  /  "apruebo esta voz"  /  "voz aprobada".

Diagnostic: $RESULT
EOF
  exit 2
fi
exit 0
