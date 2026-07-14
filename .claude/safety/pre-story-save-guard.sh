#!/usr/bin/env bash
# Claude Code PreToolUse hook for Bash — STORY VALIDATION GATE.
#
# Purpose (hard rule, 2026-07-09): make it IMPOSSIBLE to write JourneyStory
# CONTENT (text/vocab) to the database without passing the CANONICAL
# validator `validateGeneratedStory` (src/lib). The sanctioned saver
# `scripts/saveStory.ts` runs that validator in-process and refuses to
# write unless every story is green. This hook BLOCKS every OTHER execution
# path: any script or inline command that EXECUTES a journeyStory content
# write and is not the sanctioned saver.
#
# It only acts when an executor (tsx/node/ts-node/bun/deno) is present, so
# reading/grepping a save script (cat/grep/sed) is never blocked. There is
# NO CLAUDE_AUTHORIZED escape here; fix the story until saveStory.ts passes.
#
# Exit codes: 0 allow · 2 block (message to stderr).

set -euo pipefail

REPO_ROOT="/Users/alejandrodelcarpio/digital-polyglot-library"
AUDIT_LOG="$REPO_ROOT/.claude/safety/audit.log"
ALLOWED_SAVER="saveStory.ts"          # the only sanctioned content saver
WRITE_RE='journeyStory[[:space:]]*\.[[:space:]]*(create|createMany|update|updateMany|upsert)'
CONTENT_RE='(text|vocab)[[:space:]]*:'
EXEC_RE='(^|[^[:alnum:]/])(tsx|ts-node|node|bun|deno)([^[:alnum:]]|$)'

touch "$AUDIT_LOG" 2>/dev/null || true

PAYLOAD="$(cat 2>/dev/null || true)"
COMMAND="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("command") or d.get("input", {}).get("command") or "")
except Exception:
    print("")
' 2>/dev/null || true)"

[ -z "$COMMAND" ] && exit 0

# Only gate when the command actually EXECUTES code (an interpreter is invoked).
printf '%s' "$COMMAND" | grep -Eq "$EXEC_RE" || exit 0

log_audit() { printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" >> "$AUDIT_LOG" 2>/dev/null || true; }

block() {
    local reason="$1"
    log_audit "BLOCK-STORY" "$COMMAND"
    cat >&2 <<EOF
[story-gate] BLOCKED: $reason

Command refused:
  $COMMAND

A JourneyStory's text/vocab may ONLY reach the database through the
sanctioned, self-validating saver, which runs the CANONICAL validator
(validateGeneratedStory) in-process and writes nothing unless every story
is green:

  npx tsx scripts/saveStory.ts <data.json> --journey <id> \\
      --lang ES --level c1 --variant LATAM [--publish]

The Python pre-validator (_valFriends.py etc.) is a LINT, never the gate.
Do NOT bypass this by adding flags. Fix the story until saveStory.ts passes.
EOF
    exit 2
}

# 1) Inline write in the command itself (node -e / tsx -e / heredoc piped in).
if printf '%s' "$COMMAND" | grep -Eq "$WRITE_RE" && printf '%s' "$COMMAND" | grep -Eq "$CONTENT_RE"; then
    block "inline journeyStory content write (text/vocab) outside $ALLOWED_SAVER"
fi

# 2) A script file the executor runs that writes journeyStory content.
#    Extract every *.ts / *.js token, resolve against REPO_ROOT, and grep it.
for tok in $COMMAND; do
    case "$tok" in
        *.ts|*.js|*.mjs|*.cts|*.mts)
            f="${tok#./}"
            f="${f%\"}"; f="${f#\"}"; f="${f%\'}"; f="${f#\'}"
            case "$f" in
                /*) abs="$f" ;;
                *)  abs="$REPO_ROOT/$f" ;;
            esac
            [ -f "$abs" ] || continue
            base="$(basename "$abs")"
            [ "$base" = "$ALLOWED_SAVER" ] && continue
            if grep -Eq "$WRITE_RE" "$abs" && grep -Eq "$CONTENT_RE" "$abs"; then
                block "script '$f' executes a journeyStory content write (text/vocab) but is not $ALLOWED_SAVER"
            fi
            ;;
    esac
done

exit 0
