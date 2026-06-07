#!/usr/bin/env bash
# Claude Code PreToolUse hook for Bash.
#
# Two responsibilities:
#   1) SNAPSHOT  : back up .env* files BEFORE any command that could touch them.
#   2) BLOCK     : refuse irreversible / destructive commands unless the env var
#                  CLAUDE_AUTHORIZED=1 is set in the SAME line as the command.
#
# Input contract: Claude Code passes a JSON object on stdin shaped like
#   { "tool": "Bash", "input": { "command": "<the actual bash command>" , ... } }
#
# Exit codes:
#   0  : allow the command to run
#   2  : block the command and surface the message to Claude (stderr)

set -euo pipefail

REPO_ROOT="/Users/alejandrodelcarpio/digital-polyglot-library"
SNAPSHOT_ROOT="$HOME/.dpl-env-snapshots/digital-polyglot-library"
AUDIT_LOG="$REPO_ROOT/.claude/safety/audit.log"
MAX_SNAPSHOTS=100

mkdir -p "$SNAPSHOT_ROOT"
touch "$AUDIT_LOG"

# Read JSON payload from stdin
PAYLOAD="$(cat 2>/dev/null || true)"
# Extract the command field (no jq dependency; tolerate missing field)
COMMAND="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("command") or d.get("input", {}).get("command") or "")
except Exception:
    print("")
' 2>/dev/null || true)"

# Helpers ---------------------------------------------------------------------
log_audit() {
    local kind="$1" cmd="$2"
    printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$kind" "$cmd" >> "$AUDIT_LOG"
}

snapshot_env() {
    # Snapshot every existing .env* regular file (not symlinks pointing nowhere).
    local stamp
    stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
    local dest="$SNAPSHOT_ROOT/$stamp"
    local any=0
    if [ -d "$REPO_ROOT" ]; then
        for f in "$REPO_ROOT"/.env "$REPO_ROOT"/.env.local "$REPO_ROOT"/.env.sentry-build-plugin; do
            if [ -f "$f" ] && [ ! -L "$f" ]; then
                if [ "$any" = "0" ]; then mkdir -p "$dest"; chmod 700 "$dest"; any=1; fi
                cp -p "$f" "$dest/"
            fi
        done
        # also catch any worktrees holding real .env files
        if [ -d "$REPO_ROOT/.claude/worktrees" ]; then
            for wt in "$REPO_ROOT"/.claude/worktrees/*/; do
                [ -d "$wt" ] || continue
                local wt_name
                wt_name="$(basename "$wt")"
                for f in "$wt"/.env "$wt"/.env.local; do
                    if [ -f "$f" ] && [ ! -L "$f" ]; then
                        if [ "$any" = "0" ]; then mkdir -p "$dest"; chmod 700 "$dest"; any=1; fi
                        mkdir -p "$dest/worktrees/$wt_name"
                        cp -p "$f" "$dest/worktrees/$wt_name/"
                    fi
                done
            done
        fi
    fi
    if [ "$any" = "1" ]; then
        log_audit "SNAPSHOT" "$dest"
        # Rotate: keep last MAX_SNAPSHOTS
        # shellcheck disable=SC2012
        ls -1t "$SNAPSHOT_ROOT" | tail -n +$((MAX_SNAPSHOTS + 1)) | while read -r old; do
            rm -rf "${SNAPSHOT_ROOT:?}/$old"
        done
    fi
}

block() {
    local reason="$1"
    log_audit "BLOCK" "$COMMAND"
    cat >&2 <<EOF
[safety-guard] BLOCKED: $reason

Command refused:
  $COMMAND

If you genuinely need to run this, prefix the command with CLAUDE_AUTHORIZED=1.
Example:
  CLAUDE_AUTHORIZED=1 $COMMAND

Do NOT do this without explicit user instruction in the chat using an imperative
verb (e.g. "borra", "fuerza", "rota", "machaca"). Recovery from this kind of
mistake cost the user real time and broke prod. Ask the user first.
EOF
    exit 2
}

is_authorized() {
    case " $COMMAND " in
        *" CLAUDE_AUTHORIZED=1 "*|"CLAUDE_AUTHORIZED=1 "*) return 0 ;;
    esac
    [ "${CLAUDE_AUTHORIZED:-}" = "1" ]
}

# Main rules ------------------------------------------------------------------
# Empty command? allow.
[ -z "$COMMAND" ] && exit 0

# 1. Snapshot .env* opportunistically whenever a command mentions .env or rm/ln/mv/sed
#    near them. Cheap insurance; ~50ms total when nothing to do.
case "$COMMAND" in
    *".env"*|*"rm -"*|*"ln -"*"f"*|*"mv "*|*"sed -i"*|*"> .env"*|*"tee .env"*)
        snapshot_env
        ;;
esac

# 2. Hard-block: ln -sf / ln -fs / ln -f targeting .env* in the REPO ROOT.
#    The bug that started this: applying the worktree-symlink rule outside a worktree.
if printf '%s' "$COMMAND" | grep -qE '\bln[[:space:]]+-[A-Za-z]*f[A-Za-z]*[[:space:]]+\.{0,2}/?\.\./\.\./\.\./?\.env'; then
    block "ln -f overwriting .env in repo root. The '../../../.env' pattern ONLY makes sense inside .claude/worktrees/<name>/, never in the repo root. Verify pwd with 'git rev-parse --show-toplevel' first."
fi

# 3. Hard-block: rm/rm -rf on .env files.
if printf '%s' "$COMMAND" | grep -qE '\brm[[:space:]]+(-[rRfFiv]+[[:space:]]+)?[^|;&]*\.env(\.local|\.sentry|\.example)?(\b|$)'; then
    is_authorized || block "rm on .env file."
fi

# 4. Hard-block: modal secret create with --force (overwrites silently).
if printf '%s' "$COMMAND" | grep -qE '\bmodal[[:space:]]+secret[[:space:]]+(create|update)\b' \
   && printf '%s' "$COMMAND" | grep -qE '\-\-force\b'; then
    is_authorized || block "modal secret create/update --force rotates a shared secret irreversibly. Modal does NOT let you read the previous value back; rotating breaks any client still holding the old token. Ask the user explicitly."
fi

# 5. Hard-block: vercel env rm (deletes prod env vars).
if printf '%s' "$COMMAND" | grep -qE '\bvercel[[:space:]]+env[[:space:]]+rm\b'; then
    is_authorized || block "vercel env rm deletes a production environment variable. Confirm with the user first."
fi

# 6. Hard-block: git push --force / --force-with-lease / -f.
#    No env-var bypass from inside Claude. If a force push is truly
#    needed, the user runs it from their own terminal.
if printf '%s' "$COMMAND" | grep -qE '\bgit[[:space:]]+push\b' \
   && printf '%s' "$COMMAND" | grep -qE '(\-\-force(-with-lease)?|[[:space:]]-f([[:space:]]|$))'; then
    log_audit "BLOCK_FORCE_PUSH" "$COMMAND"
    cat >&2 <<EOF
[safety-guard] BLOCKED: git push --force is hard-blocked from inside Claude.

Force pushes are irreversible on the remote. There is no env-var
escape hatch from inside a Claude session. If you truly need to
force-push, run it from your own terminal.

Command refused:
  $COMMAND
EOF
    exit 2
fi

# 6b. git push to main/master: require the user's imperative verb in
#     the actual Claude transcript. The transcript_path is provided by
#     Claude Code in the hook payload (`.jsonl` file written by Claude
#     Code, not writable by Bash tool calls). Even if the model sets
#     CLAUDE_AUTHORIZED=1 or DPL_PUSH_AUTHORIZED=1 in the command
#     itself, the hook here will still block unless the user's MOST
#     RECENT message contains an imperative push verb.
#
#     Verbs that authorize: manda, mandalo, mándalo, ship, shipit,
#     shipea, shipealo, lanza, lanzalo, lánzalo, push, pushea,
#     pushealo, deploya, deployalo.
#
#     Verbs that DO NOT authorize: dale, sí, listo, ok, perfecto, ya.
#     The list is kept intentionally narrow because the previous
#     "did the user reply yes-ish?" heuristic let pushes through on
#     generic acknowledgements.
if printf '%s' "$COMMAND" | grep -qE '\bgit[[:space:]]+push\b'; then
    PUSH_TARGETS_MAIN=0
    if printf '%s' "$COMMAND" | grep -qE '(\bHEAD:(main|master)\b|[[:space:]](main|master)([[:space:]]|$)|origin[[:space:]]+(main|master)\b)'; then
        PUSH_TARGETS_MAIN=1
    fi
    # Bare `git push` with no explicit refspec: assume main (most
    # repos default-push the current branch and we're on main here).
    if [ "$PUSH_TARGETS_MAIN" = "0" ] && ! printf '%s' "$COMMAND" | grep -qE '\bgit[[:space:]]+push[[:space:]]+[^[:space:]]'; then
        PUSH_TARGETS_MAIN=1
    fi

    if [ "$PUSH_TARGETS_MAIN" = "1" ]; then
        VERB_CHECK="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
import json, sys, re, os

try:
    payload = json.load(sys.stdin)
except Exception:
    print("missing_payload"); sys.exit(0)

tp = payload.get("transcript_path") or ""
if not tp or not os.path.exists(tp):
    print("missing_transcript"); sys.exit(0)

# Read all user messages, take the most recent one only. Stale verbs
# from older messages do NOT carry over — each verb authorizes at
# most one push, after which any later user message resets the gate.
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
            content = obj.get("message", {}).get("content", "")
            if isinstance(content, str):
                msgs.append(content)
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        msgs.append(part.get("text", ""))
except Exception:
    print("read_error"); sys.exit(0)

if not msgs:
    print("no_user_messages"); sys.exit(0)

last = msgs[-1] or ""
# Strip system-reminder envelopes and tool-result wrappers; keep only
# the prose the user actually typed.
last = re.sub(r"<system-reminder>.*?</system-reminder>", "", last, flags=re.DOTALL|re.IGNORECASE)
last = re.sub(r"<task-notification>.*?</task-notification>", "", last, flags=re.DOTALL|re.IGNORECASE)

verb_pat = re.compile(
    r"\b(manda|mandalo|m[aá]ndal[oa]|ship|shipit|shipea|shipealo|"
    r"lanza|lanzalo|l[aá]nzalo|push|pushea|pushealo|deploya|deployalo)\b",
    re.IGNORECASE
)
# Sanity guard against double-negatives like "no manda nada": if the
# 12 characters before the matched verb contain a negation, ignore it.
for m in verb_pat.finditer(last):
    start = max(0, m.start() - 12)
    prefix = last[start:m.start()].lower()
    if re.search(r"\bno\s*$", prefix) or re.search(r"\bnunca\s*$", prefix):
        continue
    print("ok")
    sys.exit(0)
print("no_verb")
' 2>/dev/null || echo "python_error")"

        if [ "$VERB_CHECK" != "ok" ]; then
            log_audit "BLOCK_PUSH_NO_VERB[$VERB_CHECK]" "$COMMAND"
            cat >&2 <<EOF
[safety-guard] BLOCKED: git push to main without user verb in transcript.

This guard reads YOUR ACTUAL LAST MESSAGE from the Claude transcript
file. The model cannot fake authorization here — no env var bypass.

To authorize this push, type one of these verbs in your next message:

  manda / mandalo / ship / shipit / shipea / lanza / lanzalo /
  push / pushea / pushealo / deploya

Words that DO NOT authorize (kept intentionally distinct from
generic acknowledgements): dale, sí, listo, ok, perfecto, ya.

Each verb authorizes exactly one push; the gate resets as soon as
you send another message.

Diagnostic: $VERB_CHECK
Command refused:
  $COMMAND
EOF
            exit 2
        fi
    fi
fi

# 6c. ElevenLabs TTS spend gate. Any POST to /v1/text-to-speech (audio
#     synthesis, paid per character) requires the user's MOST RECENT
#     message to contain an explicit "generate audio" verb. Listing
#     voices (GET /v1/voices, /v1/shared-voices) and downloading the
#     free preview_url MP3s from googleapis.com / api.us.elevenlabs.io/
#     v1/voices/.../previews are free and pass through untouched.
#     Like the git-push gate: CLAUDE_AUTHORIZED=1 does NOT bypass — only
#     the verb in the transcript counts.
#
#     User rule (2026-06-01): "samples" by default = free preview URLs.
#     Only generate when the user explicitly says one of the verbs below.
if printf '%s' "$COMMAND" | grep -qE 'api\.elevenlabs\.io/v1/text-to-speech/'; then
    VERB_CHECK="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
import json, sys, re, os
try:
    payload = json.load(sys.stdin)
except Exception:
    print("missing_payload"); sys.exit(0)
tp = payload.get("transcript_path") or ""
if not tp or not os.path.exists(tp):
    print("missing_transcript"); sys.exit(0)
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
            content = obj.get("message", {}).get("content", "")
            if isinstance(content, str):
                msgs.append(content)
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        msgs.append(part.get("text", ""))
except Exception:
    print("read_error"); sys.exit(0)
if not msgs:
    print("no_user_messages"); sys.exit(0)
last = msgs[-1] or ""
last = re.sub(r"<system-reminder>.*?</system-reminder>", "", last, flags=re.DOTALL|re.IGNORECASE)
last = re.sub(r"<task-notification>.*?</task-notification>", "", last, flags=re.DOTALL|re.IGNORECASE)
# Verbs that authorize ElevenLabs synthesis. Must be followed by
# "audio" / "audios" / "el audio" within the same phrase to count.
verb_pat = re.compile(
    r"\b(genera|regenera|render|renderea|lanza|manda|haz)\s+(el\s+|los\s+)?audio[s]?\b",
    re.IGNORECASE
)
for m in verb_pat.finditer(last):
    start = max(0, m.start() - 12)
    prefix = last[start:m.start()].lower()
    if re.search(r"\bno\s*$", prefix) or re.search(r"\bnunca\s*$", prefix):
        continue
    print("ok")
    sys.exit(0)
print("no_verb")
' 2>/dev/null || echo "python_error")"

    if [ "$VERB_CHECK" != "ok" ]; then
        log_audit "BLOCK_TTS_NO_VERB[$VERB_CHECK]" "$COMMAND"
        cat >&2 <<EOF
[safety-guard] BLOCKED: ElevenLabs TTS generation without user verb.

This guard reads YOUR ACTUAL LAST MESSAGE from the Claude transcript.
No env var bypass. ElevenLabs costs real money per character; the user
rule is: never generate audio unless explicitly asked.

To authorize this generation, type one of these phrases in your next
message:
  "genera audio" / "genera el audio" / "genera los audios" /
  "regenera audio" / "lanza audio" / "manda audio" /
  "render audio" / "renderea audio" / "haz el audio"

Listing voices (GET /v1/voices, /v1/shared-voices) and downloading the
free preview_url MP3s from googleapis.com / .../v1/voices/.../previews
passes through this gate — those are FREE and the correct way to give
the user voice "samples".

Diagnostic: $VERB_CHECK
Command refused:
  $COMMAND
EOF
        exit 2
    fi
fi

# 7. Hard-block: rm -rf on paths that look like the repo root or home.
if printf '%s' "$COMMAND" | grep -qE '\brm[[:space:]]+-[rRfFv]+[[:space:]]+(/Users/[^/[:space:]]+/?[[:space:]]*$|~[[:space:]]*$|\$HOME[[:space:]]*$|\.\.[[:space:]]*$|/[[:space:]]*$|\*[[:space:]]*$)'; then
    block "rm -rf on a path that looks like \$HOME, /, or .. Never do this."
fi

# 8. Hard-block: dropping database tables (psql, prisma).
if printf '%s' "$COMMAND" | grep -qE '(DROP[[:space:]]+TABLE|DROP[[:space:]]+DATABASE|TRUNCATE)' ; then
    is_authorized || block "Destructive SQL detected. Ask the user before dropping or truncating."
fi

# All checks passed
log_audit "PASS" "$COMMAND"
exit 0
