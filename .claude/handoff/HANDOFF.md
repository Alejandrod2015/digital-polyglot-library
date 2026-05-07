# LanguageSwitcher — Handoff for Claude Code

**Target repo:** `digital-polyglot-library`
**Target screen:** Language switcher bottom sheet (Variant B — "with stats")
**Fidelity:** Adaptive — use existing repo patterns (Tailwind v4, lucide-react, `@clerk/nextjs`, `framer-motion`). Do NOT copy hex tokens from the mockup if the repo already has equivalents.

---

## Screenshot (source of truth)

See `./screenshot-variant-b.png`. The mockup JSX is in `./reference/language-switcher.jsx` (Variant B = `LangSheetB` + `LangRowStats` + `MiniStat`). Treat the mockup as a **design reference**, not a drop-in component: re-implement using repo conventions.

## What this screen is

A **bottom sheet** that opens when the user taps the active-language indicator in the mobile tab bar. It shows every language the user is studying (from Clerk `publicMetadata.targetLanguages`), the current one flagged as ACTIVE, and per-language stats (streak, total XP, CEFR level, progress ring on the flag). The user taps another language to switch, or taps "+ Add language" to go to `/settings`.

The sheet is **mobile-only** (same breakpoint as `MobileTabBar`: `md:hidden`).

## Where it plugs in

1. **Entry point** — add a tappable language indicator to `src/components/MobileTabBar.tsx`. Place it as a new cell **before** the Home tab, or replace the current app logo area. The indicator shows the active flag + CEFR level (e.g. `🇩🇪 A1`). Tapping opens the sheet.
2. **New component** — `src/components/LanguageSwitcher.tsx`. Client component. Renders the bottom sheet with backdrop + grabber + scrollable list + footer actions.
3. **Data source** — read from `useUser()` (Clerk):
   - `user.publicMetadata.targetLanguages: string[]` — the first item is the active language (this convention is already used in `src/app/journey/page.tsx`, `src/app/HomeClient.tsx`, `src/app/explore/ExploreClient.tsx`).
   - `user.publicMetadata.preferredLevel?: string` — CEFR level of the active language.
   - `user.publicMetadata.preferredVariant?: string` — regional variant (e.g. "colombia").
4. **Per-language stats** — there is currently no per-language streak/XP in the repo. **Two options, pick one and tell us in the PR:**
   - **(a) Stub with zeros for inactive languages** — show streak/XP only for the active language (reuse whatever source `JourneyClient` uses today). Simplest. Ship this first.
   - **(b) Build a new endpoint** — `GET /api/user/languages` that returns `[{ code, name, variant?, level, streak, xpTotal, progress, dueReviews, lastStudiedAt }]`. Stats come from the same place `buildJourneyTrackInsights` pulls them (`@/lib/journeyProgress`). Prefer this if the stats are already trivial to query.
5. **Switching language** — tapping a row calls `PATCH /api/user/preferences` with `{ targetLanguages: [<tapped>, ...rest] }` (endpoint already exists at `src/app/api/user/preferences/route.ts`). Then `user.reload()` + optimistic UI close. After reload, all screens that key off `targetLanguages[0]` will show the new language.

## Design tokens — use what's already there

The repo uses Tailwind v4 with CSS variables defined in `src/app/globals.css`. Use these where possible:

| Need | Repo token | Fallback |
|---|---|---|
| Sheet background | `--nav-bg` (`rgba(7,19,38,0.96)`) + a slight gradient | `bg-[#0a2b56]` → `bg-[#051834]` |
| Borders / dividers | `--nav-border` / `--card-border` | `border-white/10` |
| Primary text | `--foreground` (`#e6eaf2`) | `text-white` |
| Muted text | `--muted` (`#9aa7bd`) | `text-white/60` |
| Active accent (ACTIVE badge, ring) | **lime-300 `#BEF264`** — this is the Journey brand color, already used across `JourneyClient` | `lime-300` |
| Secondary accent (sky, CTAs) | **sky-300 `#7DD3FC`** — used in Journey | `sky-300` |
| Streak | **orange-400 `#FB923C`** | already used in `UserMetric` for streak |
| XP | lime-300 | |
| CEFR level pill | sky-300 on `sky-300/10` bg | |

## Component contract

```tsx
// src/components/LanguageSwitcher.tsx
"use client";

type LanguageStats = {
  code: string;          // "de" | "es-co" | "fr" | ...
  name: string;          // "German"
  variant?: string;      // "Colombia" (optional)
  flag: string;          // 2-letter country code for flag lib
  level: string;         // "A1"
  levelLabel?: string;   // "First steps"
  streak: number;
  xpTotal: number;
  progress: number;      // 0-100, progress within current level
  dueReviews: number;
  active: boolean;
};

export function LanguageSwitcher({
  open,
  onClose,
  languages,
  onSwitch,       // (code: string) => Promise<void>
  onAddLanguage,  // () => void  (navigates to /settings)
}: Props) { ... }
```

## Behaviour

- **Open/close** — animated slide-up with `framer-motion` (already a dep). Backdrop fades in to `black/55`. Close on backdrop tap, swipe down on grabber, or Escape key.
- **Scroll lock** — when open, lock body scroll on mobile.
- **A11y** — `role="dialog"` + `aria-modal="true"` + focus trap. Dismiss restores focus to the opener.
- **Loading state** — while `onSwitch` is pending, disable the row and show a tiny spinner in place of the chevron. Keep the sheet open until the switch resolves, then close.
- **Empty state** — if user has only 1 language, don't open the sheet; tapping the indicator goes straight to `/settings`.
- **No scrollbars visible** — follow the existing pattern (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
- **Safe area** — respect `env(safe-area-inset-bottom)` on the footer.

## Row anatomy (see screenshot)

```
┌─ 18px top padding ──────────────────────────────────┐
│  [Flag + progress ring]  Name · variant      ACTIVE │
│       46×46              🔥 streak · ⚡ XP · A1      │
└─────────────────────────────────────────────────────┘
```

- **Flag + ring** — circular flag, 46×46. A ring drawn via SVG shows `progress` %. Ring color = lime for active, sky for inactive.
- **Name + variant** — name bold `text-base`, variant dim `· Colombia` small.
- **Stats row** — three inline stats with icons (`Flame`, `Zap`, CEFR pill). Icons from `lucide-react`.
- **ACTIVE chip** (on active only) — `bg-lime-300 text-[#0a2b56]` tiny pill, uppercase, letter-spaced.
- **Chevron** (on inactive) — `lucide-react` `ChevronRight` dim.

## Footer

Two buttons side-by-side:
- `See all` → navigates to a future `/languages` page (stub route for now, link to `/settings`).
- `+ Add language` → navigates to `/settings` (the existing language picker is there).

Separator above footer: `border-t border-white/10`.

---

## Step-by-step for Code

1. Read `src/components/MobileTabBar.tsx`, `src/app/journey/page.tsx`, `src/app/journey/JourneyClient.tsx`, `src/lib/journeyProgress.ts`, `src/app/api/user/preferences/route.ts`, and `src/app/globals.css`. Understand existing patterns before writing anything.
2. Decide between stats option (a) or (b) above. Write a 2-line note in the PR description.
3. Create `src/components/LanguageSwitcher.tsx` with the contract above.
4. Add the language indicator to `MobileTabBar.tsx`. Keep the 5-tab grid intact — put the indicator **above** the tab bar (a slim 44px row) OR as a compact pill in one of the existing tab cells. Ask the user if in doubt.
5. Wire `onSwitch` to `PATCH /api/user/preferences`. Call `user.reload()` after success. Close sheet.
6. Add a minimal `/languages` placeholder page that lists all user languages (can come later).
7. Don't introduce new design tokens. Re-use `--nav-bg`, `--card-bg`, `--foreground`, `--muted`, `--card-border`. Use `lime-300`, `sky-300`, `orange-400` directly (Tailwind classes) for accents — these match Journey already.
8. Respect `md:hidden` — this is mobile-only.

## Things NOT to do

- **Don't** copy `TOKENS` from the mockup — use repo CSS vars.
- **Don't** inline SVG flags from the mockup — use a tiny flag library or emoji; we can refine later. (If you must inline, keep them to one utility file.)
- **Don't** build a new icon set — `lucide-react` is already a dep.
- **Don't** wire speaker notes, tweak panels, or any iframe chrome — those are mockup-only.
- **Don't** break the existing `MobileTabBar` 5-column layout.

## Acceptance checklist

- [ ] Tapping the language indicator in the mobile tab bar opens the sheet.
- [ ] Sheet shows every language in `publicMetadata.targetLanguages` with the first flagged ACTIVE.
- [ ] Tapping a non-active row switches the language (PATCH + reload) and closes the sheet.
- [ ] Backdrop tap / Escape / swipe-down all close the sheet.
- [ ] Sheet is `md:hidden` only. Desktop keeps the existing sidebar behavior.
- [ ] No new design tokens. No changes to the color system.
- [ ] No console errors. Sheet is keyboard-accessible.

---

## Prompt to paste into Claude Code

> Read `HANDOFF.md` in the handoff folder I just shared. Then implement the `LanguageSwitcher` bottom sheet and wire it into `MobileTabBar.tsx` exactly as specified, adapting to this repo's existing patterns (Tailwind v4 + lucide-react + Clerk + framer-motion). Before writing code, read the files listed in step 1 and confirm your implementation plan (especially your choice of stats option a or b). Ship in a single PR with a short description of the tradeoffs.
