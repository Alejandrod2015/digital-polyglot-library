# Digital Polyglot Library

## Language Instructions

**CRITICAL: Always speak in neutral Spanish (español neutro), never Argentine Spanish.**

This means:
- Use **tú** (not vos)
- Use forms like: "tienes", "quieres", "dices" (not tenés, querés, decís)
- Avoid Argentine-specific vocabulary and expressions
- Apply this to 100% of Spanish responses

Examples of what to AVOID:
- "Querés que lo analice?" → "¿Quieres que lo analice?"
- "Tenés datos?" → "¿Tienes datos?"
- "Che, necesito tu ayuda" → Don't use "che"

This is a hard constraint for this project.

## Project Context

- Monorepo: Next.js web + Expo/RN mobile
- Auth: Clerk native bridge
- iOS testing: Must use Release build on physical device (not Debug)
- API: Mobile calls reader.digitalpolyglot.com (production)
- Deployments: Batch commits to avoid multiple Vercel builds

## Safety Guard (BLOCKING — DO NOT BYPASS)

This project has a Bash PreToolUse hook at `.claude/safety/pre-bash-guard.sh`
that ALWAYS runs before any Bash command. It does two things:

1. **Snapshots every `.env*` file** in the repo (and in any worktree) to
   `~/.dpl-env-snapshots/digital-polyglot-library/<timestamp>/` before any
   command that could touch them. Keeps last 100. Cheap insurance.
2. **Hard-blocks** these patterns unless `CLAUDE_AUTHORIZED=1` is on the
   same command line:
   - `ln -*f*` overwriting `.env*` via `../../../` (the worktree symlink
     pattern applied outside a worktree)
   - `rm` on any `.env` file
   - `modal secret create|update --force` (irreversibly rotates a shared
     secret that Modal will not let you read back)
   - `vercel env rm` (deletes production env vars)
   - `git push --force` / `-f`
   - `rm -rf` on `$HOME`, `/`, `..`, `*`
   - SQL `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`

If the guard blocks a command, **DO NOT** add `CLAUDE_AUTHORIZED=1`
on your own to bypass it. That flag is for the user to type, or for
you ONLY after the user has said the imperative verb in chat (e.g.
"borra", "fuerza", "rota", "machaca"). Recovery from this kind of
mistake cost real time and broke prod once. Ask the user first.

If you need to restore `.env*` after a slip-up:
```
.claude/safety/restore-env.sh --list      # see snapshots
.claude/safety/restore-env.sh             # restore latest
```

Audit log of every command (PASS / BLOCK / SNAPSHOT):
`.claude/safety/audit.log` (gitignored).

## Pre-flight checklist for destructive operations

Before running ANY of these, STOP and re-check:
- `ln -sf ../../../.env*` → verify `git rev-parse --show-toplevel` matches
  the parent of `../../../`. The `../../../.env*` pattern only resolves
  correctly inside `.claude/worktrees/<name>/`, never in the repo root.
- `rm -rf .next` → fine, this is the only `rm -rf` that does NOT need to
  ask. All other `rm -rf` requires user verb.
- Any `--force` flag on `modal`, `vercel`, `git`, `gh` → ASK FIRST.
- Any write/delete in Modal, Vercel, Clerk, Stripe, Sanity dashboards
  via Chrome MCP → ASK FIRST. "Find a solution" does NOT authorize
  rotation of shared secrets in external services.
