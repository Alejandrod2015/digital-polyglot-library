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

## Grill before building (expensive/ambiguous features only)

When the user proposes a NEW feature that is expensive (spends image/audio
credits, Modal/ElevenLabs calls) or genuinely ambiguous (multi-file, open
product decisions), OFFER the `/grill` skill before building: a short
socratic round (max 3 ultra-short questions) that surfaces unstated
decisions so the first attempt lands aligned. Do NOT grill trivial changes
(copy tweaks, one-liners, clear asks). The user can always trigger it
manually with `/grill`.

## Reporting status — no absolute claims

**Never** declare a multi-item or multi-check task "done", "fully corrected",
"100% confidence", or "totalmente corregido" without explicitly listing:

- `verified:` the specific checks that passed (validator, audit, tests, etc.)
- `not verified:` the dimensions you did NOT measure (gestalt rhythm, native
  grammar feel, cross-item repetition, real user reading, etc.)

A passing validator is not equivalent to a good output. Validator coverage
is bounded by what was coded into it; gestalt / rhythm / cross-item patterns
require a human read.

**Mandatory gestalt step** before reporting "done" on any task that touched
3+ items in a batch (stories, voices, components, copy variants): dump the
items side-by-side and read them consecutively as the end user would. If any
template, phrase, structure, or pattern repeats across 3+ items, flag it
before declaring done. This applies even when the validator is green.

When the user pushes back ("are you sure?" / "did you really check?") more
than once, do NOT defend with the same metrics. Switch the frame of review
(structural → rhythm → tone → cross-item comparison → gestalt) until the
user's concern is addressed or you can articulate what they're asking that
you haven't measured.

## Story validation gate (BLOCKING — no bypass)

A `JourneyStory`'s content (title/slug/text/vocab/arcType/synopsis) reaches
the database ONLY through `scripts/saveStory.ts`, which runs the CANONICAL
validator `validateGeneratedStory` (`src/lib/validateGeneratedStory.ts`)
IN-PROCESS and writes nothing unless EVERY story returns `ok===true`. A second
PreToolUse hook `.claude/safety/pre-story-save-guard.sh` BLOCKS any other
execution that writes journeyStory content (bespoke `_save*.ts`, inline
`journeyStory.update/create` with `text`/`vocab`). No `CLAUDE_AUTHORIZED`
escape. Reading/grepping save scripts is fine (only executed writes are gated).

Hard rules (why: on 2026-07-09 a pilot was reported "bien validado" after only
the Python subset ran; the canonical validator then found 4 fails):
- The Python pre-validators (`scripts/_val*.py`) are LINTS, never "the
  validation". They do NOT count as validated.
- NEVER report a story "validated" / "passes" / "en verde" unless
  `validateGeneratedStory` returned `ok===true` for it (via `saveStory.ts`,
  incl. `--dry`). Cite the canonical result, not the Python subset.
- To save: `npx tsx scripts/saveStory.ts <data.json> --journey <id> --lang ES
  --level c1 --variant LATAM [--publish]`. Use `--dry` to validate without
  writing. If it fails, FIX the story; do not weaken the gate (see the
  gold-standard calibration rule).

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
   - `rm -rf` on `$HOME`, `/`, `..`, `*`
   - SQL `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`

3. **`git push --force` / `-f`**: hard-blocked from inside Claude. NO
   env-var escape. If a force push is truly needed, the user runs it
   from their own terminal outside Claude.

4. **ElevenLabs TTS generation** (POST to `api.elevenlabs.io/v1/text-to-speech/`):
   hard-blocked unless the user's MOST RECENT message in the transcript
   contains one of: "genera audio", "genera el audio", "genera los
   audios", "regenera audio", "lanza audio", "manda audio", "render
   audio", "renderea audio", "haz el audio". Same transcript-based gate
   as the push verb. `CLAUDE_AUTHORIZED=1` does NOT bypass.

   "Dame samples", "muéstrame las voces", "compara estas voces"
   = preview URLs gratis del shared library (`GET /v1/shared-voices`),
   nunca generar. Listing endpoints (GET) pasan sin gate; solo el
   endpoint de síntesis está bloqueado.

5. **`git push` to main/master**: blocked unless the user's MOST RECENT
   message in the Claude transcript contains an imperative push verb.
   The hook reads `transcript_path` from the PreToolUse payload (a
   `.jsonl` file Claude Code writes; not writable from Bash tool calls)
   and pattern-matches against the latest user message.

   - **Verbs that authorize** (case-insensitive, word-boundary): manda,
     mandalo, mándalo, ship, shipit, shipea, shipealo, lanza, lanzalo,
     lánzalo, push, pushea, pushealo, deploya, deployalo.
   - **Verbs that DO NOT authorize**: dale, sí, listo, ok, perfecto, ya.
     Generic acknowledgements are intentionally outside the gate so a
     "dale" on an unrelated question never opens the push door.
   - Negation guard: `no manda…` / `nunca manda…` immediately before
     the verb does NOT count as authorization.
   - One verb = one push. The gate resets on the next user message.

   `CLAUDE_AUTHORIZED=1` and `DPL_PUSH_AUTHORIZED=1` do **NOT** bypass
   the verb gate. The model cannot fake authorization here.

6. **Batch gate (no partial deploys)**: each push to `main` is a paid
   Vercel build, so NEVER ship while a clear deployable fix sits
   uncommitted. The `pre-push` hook blocks any push to `main` when the
   working tree has uncommitted/untracked changes under deployable
   paths (`src/`, `prisma/`, root config) that are NOT in the pushed
   commits — `apps/mobile/**` (local build, never Vercel) and
   `scripts/_*` (scratch) are excluded. The hook lists the offending
   files. **Before proposing any push, run `git status` and fold every
   ready deployable change into the same commit** — do not treat a fix
   as an isolated emergency. To consciously leave deployable WIP out,
   the override is visible and per-command:
   `DPL_PUSH_AUTHORIZED=1 DPL_PUSH_PARTIAL_OK=1 git push origin HEAD:main`.
   This rule exists because on 2026-06-13 a prod hotfix shipped while a
   ready audio-route fix sat uncommitted, costing a second build.

7. **Sample-first: NUNCA regenerar audio completo para PROBAR (BLOQUEANTE).**
   Para testear cualquier cambio que afecte el audio (fix de texto,
   normalización de números, voz, settings), sintetiza **UNA sola línea de
   muestra** (la oración/palabra afectada) con la voz que toque, via un curl
   directo a `/v1/text-to-speech`. **JAMÁS** regenerar el audio COMPLETO de
   una historia (ni un lote) solo para oír un detalle: es un desperdicio caro
   de créditos. Sugerirlo ("regenera toda la historia para oír X") está
   prohibido. Regeneración completa SOLO cuando el ENTREGABLE es ese audio
   completo y el usuario pidió explícitamente el audio de ESA historia; en ese
   caso, y solo ahí, corre el script con el opt-in consciente
   `DPL_AUDIO_FULL_OK=1`. El guard 6d bloquea los scripts `*Audio*.ts` sin ese
   flag; el sample por curl directo pasa con el verbo de audio normal.
   (Regla puesta el 2026-07-09 tras sugerir regenerar una historia entera
   para probar el fix de "B244".)

If the guard blocks a non-push command, **DO NOT** add
`CLAUDE_AUTHORIZED=1` on your own to bypass it. That flag is for the
user to type, or for you ONLY after the user has said the imperative
verb in chat (e.g. "borra", "fuerza", "rota", "machaca"). Recovery
from this kind of mistake cost real time and broke prod once. Ask the
user first.

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
