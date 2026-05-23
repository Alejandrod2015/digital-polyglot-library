#!/usr/bin/env bash
# Restore .env files from the latest snapshot under ~/.dpl-env-snapshots/.
# Usage:
#   .claude/safety/restore-env.sh           # restore from MOST RECENT snapshot
#   .claude/safety/restore-env.sh --list    # show available snapshots
#   .claude/safety/restore-env.sh <stamp>   # restore from a specific snapshot dir

set -euo pipefail

REPO_ROOT="/Users/alejandrodelcarpio/digital-polyglot-library"
SNAPSHOT_ROOT="$HOME/.dpl-env-snapshots/digital-polyglot-library"

if [ ! -d "$SNAPSHOT_ROOT" ]; then
    echo "No snapshots yet at $SNAPSHOT_ROOT" >&2
    exit 1
fi

if [ "${1:-}" = "--list" ]; then
    echo "Available snapshots (newest first):"
    ls -1t "$SNAPSHOT_ROOT" | while read -r d; do
        full="$SNAPSHOT_ROOT/$d"
        files="$(find "$full" -maxdepth 2 -type f 2>/dev/null | wc -l | tr -d ' ')"
        printf '  %s  (%s files)\n' "$d" "$files"
    done
    exit 0
fi

if [ -n "${1:-}" ]; then
    SRC="$SNAPSHOT_ROOT/$1"
    if [ ! -d "$SRC" ]; then
        echo "Snapshot not found: $1" >&2
        exit 1
    fi
else
    SRC="$(ls -1t "$SNAPSHOT_ROOT" 2>/dev/null | head -n 1)"
    if [ -z "$SRC" ]; then
        echo "No snapshots available." >&2
        exit 1
    fi
    SRC="$SNAPSHOT_ROOT/$SRC"
fi

echo "Restoring .env* from: $SRC"
echo "Target repo:          $REPO_ROOT"
echo ""

restored=0
for f in "$SRC"/.env "$SRC"/.env.local "$SRC"/.env.sentry-build-plugin; do
    base="$(basename "$f")"
    if [ -f "$f" ]; then
        target="$REPO_ROOT/$base"
        if [ -e "$target" ] || [ -L "$target" ]; then
            backup_name="$target.before-restore-$(date -u +%Y%m%dT%H%M%SZ)"
            echo "  Backing up existing $base -> $(basename "$backup_name")"
            mv "$target" "$backup_name" 2>/dev/null || rm -f "$target"
        fi
        cp -p "$f" "$target"
        chmod 600 "$target"
        echo "  Restored: $base"
        restored=$((restored + 1))
    fi
done

# Worktree snapshots
if [ -d "$SRC/worktrees" ]; then
    for wt in "$SRC/worktrees"/*/; do
        wt_name="$(basename "$wt")"
        target_dir="$REPO_ROOT/.claude/worktrees/$wt_name"
        if [ -d "$target_dir" ]; then
            for f in "$wt"/.env "$wt"/.env.local; do
                [ -f "$f" ] || continue
                base="$(basename "$f")"
                target="$target_dir/$base"
                if [ -e "$target" ]; then
                    mv "$target" "$target.before-restore-$(date -u +%Y%m%dT%H%M%SZ)" 2>/dev/null || rm -f "$target"
                fi
                cp -p "$f" "$target"
                chmod 600 "$target"
                echo "  Restored worktree: $wt_name/$base"
                restored=$((restored + 1))
            done
        fi
    done
fi

echo ""
echo "Done. Files restored: $restored"
