# Asset Roadmap

Live tracking of the strategic work to convert Digital Polyglot into a B2B/exit-grade asset. Update this doc as commits land. Last updated: 2026-05-07.

## Thesis

DPL is the instrument that captures three separately licensable corpora:

- **Asset A — Multimodal Reading-Listening-Comprehension Corpus.** Story text + word-level audio alignment + per-user comprehension events + dialect/variant tagging. Buyers: AI labs (Anthropic, OpenAI, Mistral, Cohere).
- **Asset B — AI Content-Generation Quality Corpus.** `AgentRun` history + `StoryDraft` + `QAReview` + audit scores. Training data for "how to make good language-learning content with structured QA." Buyers: education-tuned model labs, publishers (Pearson, Cornelsen, Klett).
- **Asset C — Voice Diversity Library.** `ClonedVoice` + Modal/Piper pipeline + R2 cache + word-level alignment. Dialectal voices that ElevenLabs/Cartesia underserve. Buyers: TTS companies.

**Wedge:** heritage learners (60M+ US Hispanics + diaspora communities) wanting their family's specific dialect, not Madrid Spanish or neutral. Pay 3-5x premium.

**Why now:** app is pre-launch; this is the cheapest moment to architect the data layer. Retrofitting metadata once data is unlabeled is 100x more expensive.

## Movidas

Three operational movidas execute the thesis. Order matters: each stage feeds the next.

| Movida | Goal | Status | Started | Done |
|---|---|---|---|---|
| 1 | Data layer foundation | In progress | 2026-05-07 | — |
| 2 | SRS engine on `Favorite` scaffolding | Not started | — | — |
| 3 | Day-1 dialect/heritage positioning | Not started | — | — |

## Movida 1 — Data layer foundation

Schema fields for dialect/heritage tagging on `JourneyStory` + 6 new comprehension events in `ALLOWED_EVENT_TYPES` + ReaderScreen wiring to emit them.

**Sub-pieces and deploy state:**

| Piece | Commit | State |
|---|---|---|
| Backend allowlist for 6 reader events (`/api/metrics`, `/api/mobile/metrics`) | `a7d8392` | Deployed to main |
| Mobile `vocab_clicked` wiring (ReaderScreen + `trackReaderEvent` helper) | `4d6416c` | Deployed to main; ships next TestFlight build |
| Schema fields on `JourneyStory` (`register`, `generationCohort`, `culturalTags`, `voiceProvenance`) + migration SQL | `c5e0e15` | **Local only.** Apply migration to prod DB before pushing |

**The 6 new events:**

```
vocab_clicked          (currently emitted on word tap)
word_dwell             (accepted, not wired)
audio_segment_replay   (accepted, not wired)
story_abandoned        (accepted, not wired)
vocab_marked_known     (accepted, not wired)
vocab_marked_unknown   (accepted, not wired)
```

The 5 not-yet-wired events fire when natural triggers exist:
- `word_dwell` — long-press hold timer in ReaderScreen
- `audio_segment_replay` — manual seek-back detection in audio player
- `story_abandoned` — ReaderScreen unmount before completion
- `vocab_marked_known` / `vocab_marked_unknown` — confidence flag UI (e.g. swipe in favorites, button in vocab popup)

Each becomes its own follow-up commit when the corresponding UI lands.

**To deploy commit `c5e0e15` (the schema piece):**

1. Apply migration to production DB:
   ```
   npx prisma migrate deploy
   ```
   Or run `prisma/migrations/20260507000000_add_journey_story_dialect_metadata/migration.sql` manually against the prod DB.
2. Then push the local commit to main:
   ```
   git push origin <branch>:main
   ```

The migration is additive (4 `ALTER TABLE ADD COLUMN IF NOT EXISTS`), zero risk to existing rows. Order matters because Prisma's `findUnique`/`findMany` without explicit `select` includes every schema column; if schema ships before DB has the columns, queries 500.

## Movida 2 — SRS engine on Favorite scaffolding

`Favorite` table already has `nextReviewAt`, `lastReviewedAt`, `streak`. The scaffolding is ~30% there.

**Pieces (not started):**

- FSRS algorithm implementation (~200 lines, open source) for next-review calculation
- Endpoint: `GET /api/practice/due` returns vocab to review today
- Integration with `practice_session_started` event so practice opens with SRS-due items first
- After each correct/incorrect response in practice, update `nextReviewAt` and `streak`
- Optional: surface "callback" vocab in future story generation (use Movida 1 events to know which words need reinforcement)

**Why this matters for the asset:** converts the app from passive reader into a personalized living curriculum. Each user's SRS state becomes lock-in (losing it = losing months of progress). The signal generated is high-value training data for Asset A.

## Movida 3 — Day-1 dialect/heritage positioning

Branding/copy work, not engineering. Landing page + tagline + onboarding need to make the dialect-conscious / heritage-friendly position clear before launch. Drives the right user segment, which drives the right corpus.

**Pieces (not started):**

- Landing page copy emphasizing dialect/regional/heritage angle (not "language learning" generic)
- Onboarding flow: ask user about heritage/region/family language background; route to matching dialect content
- Marketing surface for the heritage segment (TikTok hispano-gringo, IG, etc.)
- Pricing tier reflecting premium positioning ($20-30/mo, not $7)

## Deploy cadence pattern (applies to all movidas)

Split commits by deploy cadence to minimize coupling:

- **Backend / API changes** → push to main, Vercel auto-deploys (~3 min)
- **Schema migrations** → DO NOT push until migration applied to DB; otherwise routes 500
- **Mobile (apps/mobile/...)** → push to main is safe but ships only when next TestFlight build cuts; coordinate with backend deploys

For any new movida or sub-piece, classify into these three buckets and split commits accordingly.

## How to update this doc

When a piece lands, edit the relevant table row to reflect the new state. When a movida starts or completes, update the top-level summary table. Keep "Last updated" at the top in sync.

Strategic context (the thesis section) lives also in `~/.claude/projects/-Users-alejandrodelcarpio-digital-polyglot-library/memory/project_asset_thesis.md` and `project_movidas_roadmap.md` for cross-session continuity by Claude.
