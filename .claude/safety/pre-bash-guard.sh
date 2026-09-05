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

# 5b. Hard-block: cover generation outside the locked style path.
#     The user-approved style lives in scripts/cover-style.json and is
#     enforced ONLY by scripts/generateCover.ts, which ALWAYS prepends
#     styleBlock (adults 25-55, no elderly/children, zero text/lettering,
#     flat-vector fine linework). Any other Flux/cover invocation, a
#     free-form prompt, a raw generateFluxImageBuffer call, or the old
#     generateStoryCoverFromPrompt, is refused so a cover can NEVER ship
#     in an unapproved style. No env-var bypass: the whole point is that
#     the model cannot opt out of the locked style.
if printf '%s' "$COMMAND" | grep -qE '\b(tsx|ts-node|node|npx)\b' \
   && printf '%s' "$COMMAND" | grep -qE '(generateStoryCoverFromPrompt|generateFluxImageBuffer|buildCoverPrompt|generateStoryCover\.ts)'; then
    if ! printf '%s' "$COMMAND" | grep -qE 'generateCover\.ts'; then
        block "Cover generation must go through scripts/generateCover.ts, which locks the user-approved style (scripts/cover-style.json: flat-vector fine linework, adults 25-55 only, zero text). Free-form cover prompts, generateStoryCoverFromPrompt and raw generateFluxImageBuffer are disabled. Write the SCENE only to a file and run: tsx scripts/generateCover.ts <storyId> <scene-file> --set"
    fi
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
# El verbo hace falta SINTETICE COMO SINTETICE: por curl directo, o llamando a
# la libreria desde un .ts. Antes solo miraba la URL en la linea de comando, y
# por ahi pasaban los scripts de narracion (2026-09-02).
_TTS_TS=""
for _f in $(printf '%s' "$COMMAND" | grep -oE '[A-Za-z0-9_./-]+\.ts' || true); do
    for _cand in "$_f" "$CLAUDE_PROJECT_DIR/$_f" "$PWD/$_f" $(ls -d .claude/worktrees/*/"$_f" 2>/dev/null); do
        [ -f "$_cand" ] || continue
        if grep -qE 'generateAndUploadMultiVoiceAudio|generateAndUploadAudio|/v1/text-to-speech' "$_cand" 2>/dev/null; then
            _TTS_TS="$_cand"; break 2
        fi
    done
done
if printf '%s' "$COMMAND" | grep -qE 'api\.elevenlabs\.io/v1/text-to-speech/' || [ -n "$_TTS_TS" ]; then
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

# 6f. OUTBOUND EMAIL LOCK (added 2026-07-31 after five beta emails went out
#     on an ambiguous "Sí"). Sending mail to real people is irreversible and
#     outward-facing, exactly like a push or a TTS render, so it gets the same
#     transcript-based gate. CLAUDE_AUTHORIZED=1 does NOT bypass.
#
#     Triggers on anything that can put mail on the wire: the beta program
#     entry points (processApplication / sendBetaEmail / publishRelease /
#     runBetaLifecycle / _runBetaTriage), the lifecycle senders, the cron
#     endpoints that send, and direct calls to the Resend API.
#
#     Rendering emails to disk for review (scripts/_renderBetaEmails.ts) does
#     NOT match and passes through: previewing is always allowed.
#
#     Two conditions, not one. The first requires the command to actually RUN
#     something: matching the bare names alone blocked a `git commit` whose
#     MESSAGE described this very gate, and a lock that fires on harmless work
#     is a lock that gets switched off. Reading, grepping and committing code
#     that mentions these functions is not sending mail.
#     Preview runs are exempt, because the block message promises they are and
#     a guard whose text and behaviour disagree teaches people to ignore it.
#     A run is a preview when it carries --dry, or when it invokes a script
#     that only sends with an explicit --send and that flag is absent.
MAIL_PREVIEW_ONLY=0
if printf '%s' "$COMMAND" | grep -qE -- '--dry'; then
    MAIL_PREVIEW_ONLY=1
fi
#     Git no manda correo, y el "requiere ejecutar algo" de arriba no bastaba:
#     el 2026-09-05 un `git commit` quedo bloqueado porque su MENSAJE contaba
#     este mismo fallo, y la palabra "curl" en la prosa hizo de interprete. Si
#     TODOS los segmentos empiezan por git, se exime. El cuerpo de un heredoc
#     se descarta antes de mirar: ahi va el mensaje del commit, que es texto y
#     no ordenes. Basta con que un segmento no sea git para caer al gate.
GIT_ONLY="$(printf '%s' "$COMMAND" | /usr/bin/python3 -c '
import re, sys
c = sys.stdin.read()
c = re.sub(r"<<-?\s*[\x27\"]?(\w+)[\x27\"]?(.*?)^\1\b", " ", c, flags=re.S | re.M)
segs = [s.strip() for s in re.split(r"&&|\|\||;|\||\n", c) if s.strip()]
ok = bool(segs)
for s in segs:
    toks = s.split()
    i = 0
    while i < len(toks) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[i]):
        i += 1
    if i >= len(toks) or toks[i] != "git":
        ok = False
        break
print(1 if ok else 0)
' 2>/dev/null || printf 0)"
if [ "$GIT_ONLY" = "1" ]; then
    MAIL_PREVIEW_ONLY=1
fi
#     Named one by one rather than by a pattern like "any script without
#     --send". Both of these are written so that nothing leaves without that
#     flag, and that guarantee is what earns the exemption; a wildcard would
#     hand the same trust to a script written later that does not deserve it.
#     Only the PREVIEW path is exempt. With --send present these fall straight
#     through to the verb gate like everything else.
if printf '%s' "$COMMAND" | grep -qE '_personalNote|_coldNote' \
   && ! printf '%s' "$COMMAND" | grep -qE -- '--send'; then
    MAIL_PREVIEW_ONLY=1
fi
#     Reading from the provider is not sending to anyone. Asking Resend "did
#     this arrive?" was blocked, which left the honest answer to "has she got
#     my mail?" unreachable and made the guard the reason we could not verify
#     our own sends. A lock that blocks the receipt as well as the letter
#     invites someone to disable it.
#     Narrow on purpose, four conditions:
#       - every mention of the provider sits inside a `curl` invocation, so a
#         script that talks to Resend on its own never inherits the exemption;
#       - that invocation carries no write marker. curl is a GET unless a body
#         or an explicit method makes it otherwise. The markers are scanned
#         ONLY within the curl segment, not the whole line: the first version
#         scanned everything and read the `-d=` of `cut -d= -f2-` as a POST
#         body, blocking the very read it was written to allow;
#       - no other mail trigger appears, or a real sender riding along after a
#         harmless `&&` would be waved through with it;
#       - no interpreter is invoked. python3 in a pipe only parses the reply,
#         but npx/node/tsx/bash can send, and by then the URL check above has
#         already established that nothing else names the provider.
#     Anything unrecognised keeps falling through to the gate.
#     Counting here is deceptively easy to get wrong under `set -euo pipefail`,
#     and both wrong versions shipped before this one:
#       `grep -oc X || printf 0` printed grep's own "0" AND the fallback "0",
#     so the arithmetic test below received "0\n0" and aborted;
#       `grep -o X | wc -l` looks clean but grep exits 1 when it finds nothing,
#     pipefail propagates that, and set -e then killed the guard with status 1
#     BEFORE it ever reached the gate. A guard that dies quietly on the common
#     case is worse than one that blocks too much, and only the test caught it.
#     `{ grep || true; }` keeps the miss benign inside the pipeline: wc counts
#     zero lines and the whole thing still succeeds.
RESEND_CURL_SEGMENTS="$(printf '%s' "$COMMAND" | { grep -oE 'curl[^|;&]*' || true; })"
RESEND_MENTIONS="$(printf '%s' "$COMMAND" | { grep -o 'api\.resend\.com' || true; } | wc -l | tr -d '[:space:]')"
RESEND_IN_CURL="$(printf '%s' "$RESEND_CURL_SEGMENTS" | { grep -o 'api\.resend\.com' || true; } | wc -l | tr -d '[:space:]')"
#     CONFIGURAR NO ES ENVIAR (2026-08-17). La cuenta de Resend tiene rutas que
#     no mandan nada a nadie: /domains (verificacion, tracking de aperturas),
#     /api-keys, /audiences. Activar el tracking de aperturas es un PATCH a
#     /domains y el gate lo bloqueaba por llevar cuerpo, pidiendo un verbo de
#     correo que no pinta nada ahi. Lo que manda correo es /emails,
#     /emails/batch y /broadcasts/<id>/send, y esos SIGUEN bloqueados:
#     la exencion vale solo si TODAS las menciones son rutas de configuracion.
RESEND_CONFIG_URLS="$(printf '%s' "$COMMAND" | { grep -oE 'api\.resend\.com/(domains|api-keys|audiences)([/?][^"'"'"' ]*)?' || true; } | wc -l | tr -d '[:space:]')"
RESEND_SEND_URLS="$(printf '%s' "$COMMAND" | { grep -oE 'api\.resend\.com/(emails|broadcasts)' || true; } | wc -l | tr -d '[:space:]')"
if [ "$RESEND_MENTIONS" -gt 0 ] && [ "$RESEND_SEND_URLS" -eq 0 ] \
   && [ "$RESEND_CONFIG_URLS" -eq "$RESEND_MENTIONS" ] \
   && [ "$RESEND_MENTIONS" -eq "$RESEND_IN_CURL" ] \
   && ! printf '%s' "$COMMAND" | grep -qE '(^|[|;&[:space:]])(npx|node|npm|pnpm|yarn|tsx|bash|sh)[[:space:]]'; then
    MAIL_PREVIEW_ONLY=1
fi
if [ "$RESEND_MENTIONS" -gt 0 ] && [ "$RESEND_MENTIONS" -eq "$RESEND_IN_CURL" ] \
   && ! printf '%s' "$RESEND_CURL_SEGMENTS" | grep -qE -- '-X[[:space:]]*"?(POST|PUT|PATCH|DELETE)|--request[[:space:]]*"?(POST|PUT|PATCH|DELETE)|(^|[[:space:]])-d([[:space:]]|=|@|['"'"'"{])|--data|--json|(^|[[:space:]])-F([[:space:]]|=|@)|--form|--upload-file|(^|[[:space:]])-T([[:space:]]|=|@)' \
   && ! printf '%s' "$COMMAND" | grep -qE '(^|[|;&[:space:]])(npx|node|npm|pnpm|yarn|tsx|bash|sh)[[:space:]]' \
   && ! printf '%s' "$COMMAND" | grep -qE 'processApplication|inviteApplicant|declineApplicant|waitlistApplicant|removeTesterAccess|linkClerkUserToBetaSignup|sendBetaEmail|sendPersonalNote|_personalNote|_coldNote|publishRelease|runBetaLifecycle|_runBetaTriage|sendLifecycleEmail|sendWelcomeEmail|sendBetaConfirmationEmail|sendClaimEmail|runLifecycleEmails|resend\.emails\.send|/api/cron/(beta-lifecycle|lifecycle-emails|claim-reminders)'; then
    MAIL_PREVIEW_ONLY=1
fi

if [ "$MAIL_PREVIEW_ONLY" -eq 0 ] \
   && printf '%s' "$COMMAND" | grep -qE '(^|[|;&[:space:]])(npx|node|npm|pnpm|yarn|tsx|curl|bash|sh|python3?)[[:space:]]' \
   && printf '%s' "$COMMAND" | grep -qE 'processApplication|inviteApplicant|declineApplicant|waitlistApplicant|removeTesterAccess|linkClerkUserToBetaSignup|sendBetaEmail|sendPersonalNote|_personalNote|_coldNote|publishRelease|runBetaLifecycle|_runBetaTriage|sendLifecycleEmail|sendWelcomeEmail|sendBetaConfirmationEmail|sendClaimEmail|runLifecycleEmails|api\.resend\.com|resend\.emails\.send|/api/cron/(beta-lifecycle|lifecycle-emails|claim-reminders)'; then
    MAIL_CHECK="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
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
# The verb must name the mail. A bare "si" / "dale" / "ejecuta" never counts:
# that ambiguity is the whole reason this gate exists.
verb_pat = re.compile(
    r"\b(manda|mandalos|mandalo|mándalo|envía|envia|envialos|envíalos|dispara|lanza)\s+"
    r"(el\s+|los\s+|las\s+|un\s+)?(correo|correos|email|emails|mail|mails)\b",
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

    if [ "$MAIL_CHECK" != "ok" ]; then
        log_audit "BLOCK_EMAIL_NO_VERB[$MAIL_CHECK]" "$COMMAND"
        cat >&2 <<EOF
[safety-guard] BLOCKED: outbound email without an explicit user verb.

This guard reads YOUR ACTUAL LAST MESSAGE from the Claude transcript.
No env var bypass. Email to real people cannot be unsent.

A bare "si", "dale", "ok" or "ejecuta" does NOT authorize a send. The
verb must name the mail, e.g.:
  "manda el correo" / "manda los correos" / "envia los correos" /
  "lanza los correos" / "dispara el correo"

Previewing is always allowed: scripts/_renderBetaEmails.ts writes the
HTML to disk and sends nothing. Add --dry to the triage script to see
verdicts without notifying anyone.

Diagnostic: $MAIL_CHECK
Command refused:
  $COMMAND
EOF
        exit 2
    fi
    log_audit "PASS_EMAIL_VERB_OK" "$COMMAND"
fi

# 6d. Full-story audio regeneration lock (SAMPLE-FIRST).
#     Regenerar el audio COMPLETO de una historia (o un lote) SOLO para
#     PROBAR un cambio (fix de texto/normalización/voz/settings) es un
#     desperdicio caro y está prohibido. Testear = UNA sola línea de muestra
#     (la oración afectada) via un curl directo a /v1/text-to-speech.
#     Este candado bloquea CUALQUIER script de generación de audio (tsx/node
#     ... generate*Audio*.ts / _gen*Audio.ts / render*Audio*.ts) salvo el
#     opt-in CONSCIENTE `DPL_AUDIO_FULL_OK=1` en la misma línea. Un sample por
#     curl directo (no script) no matchea y pasa con el verbo normal (6c).
#     El flag es para cuando el ENTREGABLE es el audio completo de esa
#     historia y el usuario lo pidió, NUNCA para un test.
#     OJO (2026-09-02): esto matcheaba por NOMBRE de archivo, y por eso
#     `scripts/_narraUnaA2.ts` narraba historias enteras sin pasar por aqui:
#     no lleva "audio" en el nombre. Ahora se mira tambien el CONTENIDO del
#     .ts invocado, que es lo que de verdad sintetiza.
# Los scripts de MUESTRA quedan fuera del candado: sintetizan titulo y primer
# parrafo, que es justo lo que la regla sample-first pide antes de pagar la
# historia entera. Meterlos dentro convertia el candado en un muro contra su
# propia recomendacion (2026-09-02).
_ES_MUESTRA=0
printf '%s' "$COMMAND" | grep -qiE '(_muestra|_sample)[A-Za-z0-9_]*\.ts' && _ES_MUESTRA=1
_TS_AUDIO=""
# La ruta del comando es relativa al cwd de QUIEN lo lanza, que puede ser un
# worktree, mientras el hook corre desde el repo principal. Se prueban las dos.
for _f in $(printf '%s' "$COMMAND" | grep -oE '[A-Za-z0-9_./-]+\.ts' || true); do
    for _cand in "$_f" "$CLAUDE_PROJECT_DIR/$_f" "$PWD/$_f" $(ls -d .claude/worktrees/*/"$_f" 2>/dev/null); do
        [ -f "$_cand" ] || continue
        if grep -qE 'generateAndUploadMultiVoiceAudio|generateAndUploadAudio|/v1/text-to-speech' "$_cand" 2>/dev/null; then
            _TS_AUDIO="$_cand"; break 2
        fi
    done
done
if printf '%s' "$COMMAND" | grep -qE '\b(tsx|ts-node|node|npx)\b' \
   && { printf '%s' "$COMMAND" | grep -qiE '(generate|render|_gen)[a-z0-9_]*audio[a-z0-9_]*\.ts' || [ -n "$_TS_AUDIO" ]; } \
   && [ "$_ES_MUESTRA" -eq 0 ] \
   && ! printf '%s' "$COMMAND" | grep -qiE 'timing'; then
    if ! printf '%s' "$COMMAND" | grep -qE 'DPL_AUDIO_FULL_OK=1'; then
        block "Full-story audio regeneration is locked (sample-first). Regenerar el audio COMPLETO de una historia para PROBAR un cambio es un desperdicio caro. Testea con UNA sola linea de muestra (la oracion afectada) via un curl directo a api.elevenlabs.io/v1/text-to-speech (eso pasa con el verbo de audio, 6c). Solo si el ENTREGABLE es el audio COMPLETO de esa historia (no un test) y el usuario lo pidio explicitamente, corre con el opt-in consciente: DPL_AUDIO_FULL_OK=1 <comando>."
    fi
fi

# 6e. QA-gate lock for practice-audio generation (2026-07-23). Todo script que
#     sintetice ElevenLabs TTS (contiene la URL /v1/text-to-speech en su fuente)
#     DEBE incluir el gate de entonacion F0 (referencia a `_f0gate`): mide el
#     tono FINAL de cada render y RE-TIRA hasta que quede como AFIRMACION (no
#     uptalk / "suena a pregunta") y con la entonacion correcta. Sin ese gate se
#     generan clips mal entonados y se DESPERDICIAN creditos regenerando.
#     (Regla puesta tras desperdiciar un lote de clips de palabra sin gate.)
#     Se inspecciona el ARCHIVO .ts invocado, no solo el comando.
if printf '%s' "$COMMAND" | grep -qE '\b(tsx|ts-node|node|npx)\b'; then
    for _ts in $(printf '%s' "$COMMAND" | grep -oE '[A-Za-z0-9_./-]+\.ts'); do
        [ -f "$_ts" ] || continue
        if grep -qE 'api\.elevenlabs\.io/v1/text-to-speech' "$_ts" \
           && ! grep -qE '_f0gate' "$_ts"; then
            block "Generacion de audio SIN gate de QA de entonacion. El script $_ts sintetiza ElevenLabs TTS pero no referencia el gate F0 (_f0gate), que re-tira hasta que quede como afirmacion (no uptalk / 'suena a pregunta'). Sin el se generan clips mal entonados y se desperdician creditos regenerando. Anade el gate F0 al render (como scripts/_genPracticeClips.ts / scripts/_genWordClips.ts) ANTES de generar una sola linea."
        fi
    done
fi

# 6g. Narracion de historias: SOLO el pipeline por segmentos (2026-08-14).
#     El audio de una JourneyStory se genera SIEMPRE con
#     `generateAndUploadMultiVoiceAudio`, que trocea por parrafo, cachea cada
#     trozo por contenido en media/multivoice-segments/ y escribe
#     `audioFragments`. Eso es lo que permite RE-TIRAR una sola oracion cuando
#     el TTS balbucea, sin pagar la historia entera.
#
#     `generateAndUploadAudio` (rama de voz unica) devuelve un master de una
#     pieza y NO guarda fragmentos: una vez generado asi, corregir una frase
#     obliga a rehacer la historia completa.
#
#     WHY: el 2026-08-14 escribi un script propio con esa rama y genere las 3
#     historias nuevas del A0 portugues sin fragmentos, ademas de borrarles el
#     dialogueSpec, que es lo que enruta al pipeline correcto. Tres historias
#     quedaron sin poder corregirse por oracion. No cambio el sistema: elegi
#     otro camino. Sin este gate, nada impedia repetirlo.
#
#     Se inspecciona el ARCHIVO .ts invocado, igual que 6e.
if printf '%s' "$COMMAND" | grep -qE '\b(tsx|ts-node|node|npx)\b'; then
    for _ts in $(printf '%s' "$COMMAND" | grep -oE '[A-Za-z0-9_./-]+\.ts'); do
        [ -f "$_ts" ] || continue
        # Solo aplica a scripts que escriben el audio de una JourneyStory.
        if grep -qE 'journeyStory\.update' "$_ts" \
           && grep -qE '\bgenerateAndUploadAudio\b' "$_ts" \
           && ! grep -qE 'generateAndUploadMultiVoiceAudio' "$_ts"; then
            block "Narracion de historia por la rama de VOZ UNICA. El script $_ts llama a generateAndUploadAudio, que devuelve un master de una pieza y NO escribe audioFragments: despues, arreglar una sola oracion obliga a rehacer la historia entera y a pagarla entera. El pipeline de journey stories es SIEMPRE generateAndUploadMultiVoiceAudio, que trocea por parrafo, cachea cada trozo y escribe audioFragments. Paso el 2026-08-14 con las 3 historias del A0 portugues."
        fi
        # Borrar el dialogueSpec es lo que desvia al pipeline equivocado.
        if grep -qE 'dialogueSpec:\s*(undefined|Prisma\.(Db|Json)Null)' "$_ts"; then
            block "El script $_ts BORRA dialogueSpec de una historia. Ese campo es lo que enruta el audio al pipeline por segmentos; sin el, la generacion cae a voz unica y la historia pierde la capacidad de re-tirar una oracion suelta. Si el reparto cambio, REESCRIBE el dialogueSpec con el texto nuevo en vez de borrarlo."
        fi
    done
fi

# 6g. IMAGE SPEND LOCK (2026-08-24). Cada imagen cuesta dinero real y el usuario
#     lo controla imagen a imagen. Dos candados, no uno:
#
#       (1) el ULTIMO mensaje del usuario tiene que nombrar la imagen con un
#           verbo ("genera la portada", "regenera la imagen"). Un "dale", un
#           "sigue" o un "ok" NO autorizan, igual que en el porton de audio.
#       (2) UN disparador = UNA imagen. El mensaje que autoriza se apunta en
#           `.claude/safety/.image-spend`; si ese mismo mensaje ya gasto una
#           tirada, la siguiente se BLOQUEA aunque el verbo siga ahi.
#
#     WHY: el 2026-08-24, con un solo "genera la portada", tire dos veces la
#     primera portada del A1 latam. Habia leido el "TOPE: 2 tiradas por portada"
#     de CLAUDE.md como un presupuesto que podia gastarme solo; es un techo que
#     prohibe seguir tirando, no un permiso. El usuario: "Cambia para que nunca
#     vuelvas a generar algo sin que yo te lo diga. Nada de 2 tiradas, solo 1."
#     Si la tirada sale mal, se ENSENA y se espera. CLAUDE_AUTHORIZED=1 no lo
#     salta. `--dry` no cuesta nada y pasa.
if printf '%s' "$COMMAND" | grep -qE '(generateCover\.ts|_gen[A-Za-z0-9]*Covers?\.ts|api\.bfl\.ai|api\.us1\.bfl\.ai|generateFluxImageBuffer|images/generations|gemini-[0-9a-z.-]*image)' \
   && ! printf '%s' "$COMMAND" | grep -qE -- '--dry'; then
    IMG_CHECK="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
import json, sys, re, os, hashlib
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
# El verbo tiene que NOMBRAR la imagen. "dale" / "sigue" / "ok" no valen.
verb_pat = re.compile(
    r"\b(genera|regenera|lanza|manda|haz|tira|renderea|render)\s+(el\s+|la\s+|los\s+|las\s+|una\s+|un\s+)?"
    r"(portada|portadas|imagen|imagenes|imágenes|cover|covers)\b",
    re.IGNORECASE)
autorizado = False
for m in verb_pat.finditer(last):
    prefix = last[max(0, m.start() - 12):m.start()].lower()
    if re.search(r"\bno\s*$", prefix) or re.search(r"\bnunca\s*$", prefix):
        continue
    autorizado = True
    break
if not autorizado:
    print("no_verb"); sys.exit(0)
# Un disparador, una imagen.
huella = hashlib.sha1(last.strip().encode("utf-8")).hexdigest()[:16]
libro = os.path.join(os.path.dirname(tp), "..", "..", ".image-spend")
libro = os.environ.get("DPL_IMAGE_SPEND_FILE") or ".claude/safety/.image-spend"
try:
    gastados = set(open(libro).read().split())
except Exception:
    gastados = set()
if huella in gastados:
    print("already_spent"); sys.exit(0)
try:
    os.makedirs(os.path.dirname(libro), exist_ok=True)
    with open(libro, "a") as f:
        f.write(huella + "\n")
except Exception:
    pass
print("ok")
' 2>/dev/null || echo "python_error")"

    if [ "$IMG_CHECK" != "ok" ]; then
        log_audit "BLOCK_IMAGE[$IMG_CHECK]" "$COMMAND"
        if [ "$IMG_CHECK" = "already_spent" ]; then
            cat >&2 <<EOF
[safety-guard] BLOCKED: este mensaje del usuario YA gasto su imagen.

Un disparador = UNA imagen. No hay presupuesto de dos tiradas: el "TOPE: 2"
de CLAUDE.md era un techo, y desde el 2026-08-24 el tope es 1.

Si la tirada salio mal, ENSENALA, di que esta mal y ESPERA. El usuario decide
si se vuelve a tirar, y para eso tiene que escribirlo otra vez.

Command refused:
  $COMMAND
EOF
        else
            cat >&2 <<EOF
[safety-guard] BLOCKED: generacion de imagen sin verbo del usuario.

Este guard lee el ULTIMO mensaje del usuario en el transcript. Sin bypass por
variable de entorno: cada imagen cuesta dinero real.

Para autorizar, el usuario escribe en su proximo mensaje algo que NOMBRE la
imagen:
  "genera la portada" / "regenera la portada" / "genera la imagen" /
  "lanza la imagen" / "haz la portada" / "tira la portada"

"dale", "sigue", "ok" y "perfecto" NO autorizan, a proposito.
Componer el prompt y verlo con --dry es gratis y pasa sin gate.

Diagnostic: $IMG_CHECK
Command refused:
  $COMMAND
EOF
        fi
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
