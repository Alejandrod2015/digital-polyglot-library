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

# 6. Hard-block: git push --force / --force-with-lease / -f to remote.
if printf '%s' "$COMMAND" | grep -qE '\bgit[[:space:]]+push\b' \
   && printf '%s' "$COMMAND" | grep -qE '(\-\-force(-with-lease)?|[[:space:]]-f([[:space:]]|$))'; then
    is_authorized || block "git push --force can destroy history on the remote. Never do this without explicit user instruction."
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
