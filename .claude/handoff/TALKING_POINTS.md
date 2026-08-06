# Talking Points — Handoff for Claude Code

**Target repo:** `digital-polyglot-library`
**Target screens:** `/talking-points` (browse) and `/talking-points/piece/[slug]` (reader)
**Chosen direction:** **Variant C — angle-first grid** (picked 2026-08-05)
**Fidelity:** Adaptive — use existing repo patterns (Tailwind v4, lucide-react, CSS vars in `globals.css`). Do NOT copy hex tokens from the mockup where the repo already has equivalents.

---

## Screenshot (source of truth)

`.claude/handoff/talking-points/variants.html` — three directions side by side at a real 390×844.
**Column C is the chosen one.** A and B are kept in the file only as the record of what was rejected and why; do not implement them.

A working reference implementation already exists in the prototype worktree
(`src/app/talking-points/`). Treat it as a **reference**, not a drop-in: it runs
on a hardcoded catalogue with no database and no audio.

## What this section is

Short non-fiction in the target language: two to three minute pieces about what
people in that country are actually arguing about. Three formats, called
**angles**:

| Angle | Label in UI | What it is |
|---|---|---|
| `explainer` | Explainer | Why something is happening. Context, not the event. |
| `debate` | Both sides | A live dispute, both positions argued fairly. |
| `portrait` | Portrait | One person or one place, concrete and small. |

Each piece belongs to a **topic** (e.g. "Tourism & Housing"), and each topic to
a **category** (e.g. "City & Housing").

## What it deliberately is NOT

This is the part most likely to get rebuilt wrong, so it is stated first.

- **No journey path.** No topic banners, no zigzag of story cards, no locks, no
  "next", no completion counter, no `JourneyTopicBanner` / `JourneyStoryCard`.
  The path is a metaphor for progression: in a journey, story 2 follows story 1
  because they share characters, vocabulary and an arc, which is why the
  continuity gates exist. Non-fiction has none of that. A path here would be a
  lie about the content.
- **No picker, no run, no "choose 7 topics".** Two earlier attempts put a
  selection screen in front of the section. If a screen needs a "do it for me"
  button to be bearable, it does not belong on the critical path.
- **No cadence promise.** No "new this week", no dates anywhere in the UI. The
  catalogue grows in batches; the day you do not publish, nobody notices.

The **reader** is the one place where this DOES look exactly like a journey:
same audio, karaoke, tap-any-word, vocabulary and practice. Reuse the existing
story reader rather than building a second one.

## Access

**Polyglot (and owner) only**, exactly like `/create`.

- `canAccessTalkingPoints(plan)` in `src/lib/talkingPoints.ts` is the single
  source of truth. Both routes call it and `notFound()` otherwise — hiding a
  nav link is not a gate, and a deep link must not bypass the plan.
- It carries one development escape so the prototype opens in a worktree with
  no Clerk keys. It cannot fire in production: it requires
  `NODE_ENV === "development"` **and** no publishable key configured.
- Both gated routes are `force-dynamic`; they read the session, so they cannot
  be prerendered.

## Where it plugs in

1. **Route** — `src/app/talking-points/page.tsx` (browse) and
   `src/app/talking-points/piece/[slug]/page.tsx` (reader).
2. **Reader chrome** — `src/components/StoryReaderShell.tsx`, extracted from
   the story route so there is one reader. **`src/app/stories/[slug]/page.tsx`
   must be switched to it in the same PR**, or the two copies drift again.
   That swap is deliberately not done in the prototype: the worktree has no
   database, so the story route cannot be exercised there, and it carries
   tap-gloss, karaoke, the plan gate and the cover blur backdrop.
3. **Nav** — entry added to `src/components/Sidebar.tsx` (after Create) and
   `src/app/menu/MenuClient.tsx`, both behind `plan === "polyglot"`. Nothing
   was added to `src/components/MobileTabBar.tsx`: it is a 5-column grid and
   changing that layout needs a decision, not an assumption.
3. **Data** — new Prisma models. The prototype's `src/lib/talkingPoints.ts`
   defines the shape (`TalkingTopic`, `TalkingPiece`, `TalkingSource`,
   `TalkingVocab`). Port that shape; do not port the hardcoded literal.
4. **Read state** — the prototype uses `localStorage`. Production should use
   the same progress store the rest of the app uses. There is nothing to
   "complete", so do not wire XP or streaks to it without asking.
5. **Audio** — same pipeline as journey stories, same approved-voice gate
   (`assertVoiceApproved`), same F0 intonation gate. Voice follows the country
   of the topic, as everywhere else.

## Design tokens — use what's already there

| Need | Repo token | Notes |
|---|---|---|
| Page background | `--bg-content` | |
| Card background | `--bg-1`, hover `--bg-2` | Cards are solid panels here, not `--card-bg` glass |
| Card border (unwritten only) | `--card-border`, dashed | Written cards have no border, only the angle bar |
| Primary text | `--foreground` | |
| Muted text | `--muted` | |
| Active filter chip | `--color-gold` on `#0b1220` text | Same gold as the rest of the app |
| Read check | `#5dd9e8` on `#06283d` | Same cyan as the journey "done" state |

**Angle colours are new and load-bearing** — the coloured bar is the card's
only chrome, so these three are not decoration:

| Angle | Bar / label | Label background |
|---|---|---|
| Explainer | `#5aa9f8` | `rgba(90,169,248,.16)` |
| Both sides | `#ffab3d` | `rgba(255,171,61,.16)` |
| Portrait | `#bd8bf0` | `rgba(189,139,240,.16)` |

## Browse screen anatomy

```
TALKING POINTS                          eyebrow, gold, 11px/900
What Spain is arguing about             30px/900, -0.03em
Short non-fiction in Spanish. …         14px/700, muted

[ All ][ Explainer ][ Both sides ][ Portrait ]   ← primary filter, pills
 All topics  City & Housing  Money & Work …      ← secondary filter, underline

┌───────────────┐ ┌───────────────┐
│▌BOTH SIDES 🇪🇸 │ │▌EXPLAINER 🇪🇸 ✓│   ▌ = 4px angle bar, full height
│               │ │               │
│ ¿Debería      │ │ Bajan los     │   question, 15.5px/900, 1.28
│ España limitar│ │ pisos …       │
│               │ │               │
│ You are the   │ │ The obvious   │   English hook, 11.5px/700, muted
│ tourist. …    │ │ fix isn't …   │
│               │ │               │
│ TOURISM &     │ │ TOURISM &     │   topic, 9px/900, tracked, muted
│ HOUSING       │ │ HOUSING       │
└───────────────┘ └───────────────┘
```

- **Two columns on mobile, three from `sm`.** Gap 10px, radius 16px, min height 164px.
- **The question is the artwork.** No cover images anywhere in this section, ever.
- **Angle is the primary axis, not category.** It tells the user something they
  cannot guess from the title, and it teaches them that three formats exist.
  Category is one row down and visually lighter on purpose.
- **Unwritten pieces still show**, as a dashed card in muted text with
  "Not written yet" where the topic label goes. They are the honest signal that
  the catalogue is growing, and they never link to an empty reader.
- **Read pieces** get the cyan check top-right. That is a record, not progress.

## Reader screen anatomy

Header (flag, language, angle pill, topic) → question as `h1` → English hook →
audio player → body prose at 18px/1.7 → "Words worth keeping" vocabulary grid
(2 columns: term, then `type · English definition`) → **Sources panel, always
open** → "More on {topic}", two related pieces.

## Sourcing rules — specific to this section

Non-fiction is where a hallucination costs the most: the user is listening, in
a language they do not command, with no way to doubt. So:

- **Every factual claim maps to a cited source.** A piece does not publish
  otherwise. This is the non-fiction equivalent of `validateGeneratedStory`.
- **Sources are institutions**, never press: statistics offices, central banks,
  government agencies, open-access academia. Press may be used to FIND a
  dispute, never quoted as the source of a fact.
- **The sources panel is open by default.** It is the only reason a listener
  should believe the piece; it does not go behind a disclosure triangle.
- **Prefer facts that do not move**: history, etymology, structure. Avoid
  superlatives and current-year statistics, or the evergreen catalogue rots.
- A source whose figure has not been confirmed against the primary tables
  carries an amber `FIGURE UNCONFIRMED` badge rather than being quietly shipped.

## Things NOT to do

- **Don't** reuse `JourneyTopicBanner` or `JourneyStoryCard` here. See "What it
  deliberately is NOT".
- **Don't** add a cover image to the cards, even a generated one.
- **Don't** lift copy from the Claude Design mockup
  (`claude.ai/design/p/4cc327a3-acd9-4da0-bcf5-d220d61187d3`). Its body text
  contains an invented visitor statistic. Mockup prose is layout filler.
- **Don't** introduce new spacing or radius scales; the angle colours are the
  only new tokens.
- **Don't** wire XP, streaks or a completion percentage to this section without
  asking first.

## Acceptance checklist

- [ ] `/talking-points` renders a two-column grid on mobile, three from `sm`.
- [ ] Angle filter and category filter both work and combine.
- [ ] Written and unwritten cards are visually distinct; unwritten never links to an empty reader.
- [ ] Read pieces show the cyan check and it survives a reload.
- [ ] The reader plays audio with an approved voice and shows the sources panel open.
- [ ] Every piece in the DB has at least one source, enforced at write time.
- [ ] No topic banner, no zigzag path, no locks, no "next", no completion counter anywhere.
- [ ] Works in light and dark theme. No console errors.

---

## Prompt to paste into Claude Code

> Read `.claude/handoff/TALKING_POINTS.md`. Then implement the Talking Points
> section following variant C, adapting to this repo's existing patterns
> (Tailwind v4, lucide-react, CSS vars in `globals.css`). Open
> `.claude/handoff/talking-points/variants.html` and match column C. Before writing code, read
> `src/app/talking-points/` in the `talking-points` worktree as a reference
> implementation, plus `src/components/Sidebar.tsx`, `src/components/MobileTabBar.tsx`
> and `prisma/schema.prisma`, and confirm your data-model plan. Do not reuse the
> journey path components. Ship in one PR with a short note on the tradeoffs.
