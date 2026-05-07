# Handoff — Language Switcher (Variante B) · Pixel-perfect

> **Goal:** Replace `src/components/LanguageSwitcher.tsx` so it matches the
> mockup at `mockup-reference.html` **exactly**. This handoff is engineered
> for "ship the visual in one PR" — backend integration is a follow-up.

---

## 1. Strategy: ship in **two PRs**

Trying to ship UI + data integration in one PR is what makes mockups drift.
Split it:

### PR 1 — Visual parity (this handoff covers it 100%)

- Drop in `LanguageSwitcher.tsx` from this folder.
- Use **mock stats** wired into `publicMetadata` reads, with safe fallbacks.
- The component renders pixel-identical to `mockup-reference.html` regardless
  of what's in the DB.
- **No schema changes, no API changes.**

### PR 2 — Real data (do not block PR 1 on this)

- Add `targetLanguagesStats` to `publicMetadata` server-side.
- Wire streak / XP / progress / dueReviews from real sources.
- The component already reads from `publicMetadata.targetLanguagesStats` — it
  will start showing real numbers automatically once they're populated.

---

## 2. Navigation: where do "See all" and "Add language" go?

The existing component sends both to `/settings`. That's the right destination,
but they should land in different sections:

| Button | Destination | Why |
|---|---|---|
| **See all** (gear icon) | `/settings#languages` | Jump to the language management section so the user can reorder, set CEFR per language, change variants, remove languages. |
| **Add language** (+ icon) | `/settings#languages?add=1` | Same screen, but with the "add" flow auto-opened. The settings page already imports `targetLanguages` and has the picker logic (see `src/app/settings/page.tsx` lines 196, 297, 311). |

**If `/settings` doesn't yet support the `#languages` anchor or `?add=1` query
param**, the change is trivial:

```tsx
// In src/app/settings/page.tsx, add:
useEffect(() => {
  if (window.location.hash === "#languages") {
    document.getElementById("languages-section")?.scrollIntoView();
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("add") === "1") {
    setLanguagePickerOpen(true); // or whatever state controls the add flow
  }
}, []);
```

And put `id="languages-section"` on the `<section>` that wraps the language
list in settings. That's it.

> **If you want a dedicated "My Languages" full screen instead of jumping to
> settings**, that's a future enhancement — not in scope for matching the
> mockup. The mockup shows the bottom sheet only.

---

## 3. The 5-step recipe for pixel-perfect parity

Follow these in order. Skipping any of them is what causes drift.

### Step 1 — Open the reference

```
open handoff/mockup-reference.html
```

This is the source of truth. Every visual decision in the `.tsx` was made
against this file. Keep it open in a browser tab while you implement.

### Step 2 — Replace the file

```bash
cp handoff/LanguageSwitcher.tsx src/components/LanguageSwitcher.tsx
```

The drop-in already includes:
- The progress ring SVG (correct geometry: r=20.5, stroke-width=2.5)
- The stats row (Flame size 11, Zap size 11, both font-weight 900, size 12px)
- The `readStatsByName()` helper that reads from `publicMetadata`
- All the existing sheet behavior (drag, scrim, Escape, scroll lock) untouched

### Step 3 — Verify dependencies are present

```bash
grep -E "Flame|Zap" node_modules/lucide-react/dist/lucide-react.d.ts
```

Should return both. They've been in `lucide-react` since v0.x — should be a no-op.

### Step 4 — Wire mock data so the UI renders correctly today

Until PR 2 lands with real stats, the component would render `🔥 0 · ⚡ 0 · 0%`
on every row. To get the mockup look in dev, **inject mock data once** at the
component level. Two clean options — pick one:

**Option A — Mock at the component (cleanest, easiest to remove later).**

In `LanguageSwitcher.tsx`, replace the `readStatsByName(metadata)` call with:

```ts
const statsByName = readStatsByName(metadata);
// MOCK DATA — remove when PR 2 lands and publicMetadata.targetLanguagesStats
// is populated server-side.
if (statsByName.size === 0) {
  const mock: Record<string, { streak: number; xpTotal: number; progress: number }> = {
    German:   { streak: 7,  xpTotal: 1240, progress: 42 },
    Spanish:  { streak: 21, xpTotal: 8450, progress: 78 },
    French:   { streak: 0,  xpTotal: 120,  progress: 8  },
    Japanese: { streak: 3,  xpTotal: 560,  progress: 18 },
    Italian:  { streak: 0,  xpTotal: 0,    progress: 0  },
    Portuguese:{streak: 0,  xpTotal: 0,    progress: 0  },
  };
  for (const [name, s] of Object.entries(mock)) statsByName.set(name, s);
}
```

This is the line marked `// MOCK DATA` — **leave the comment**. PR 2 reviewer
greps for it and removes the block in one diff.

**Option B — Mock at Clerk (one-time dev seed).**

Run this once in the Clerk dashboard or via a dev script:

```ts
await user.update({
  publicMetadata: {
    ...user.publicMetadata,
    targetLanguagesStats: [
      { name: "German",  streak: 7,  xpTotal: 1240, progress: 42 },
      { name: "Spanish", streak: 21, xpTotal: 8450, progress: 78 },
      // ...
    ],
  },
});
```

No code change. PR 2 just overwrites the metadata server-side.

### Step 5 — Visual diff against the reference

Open both side-by-side:
- Left: `mockup-reference.html` in a browser at 390×780.
- Right: your dev environment with the sheet open at the same size.

Check this list — all should match within 1px:

- [ ] Sheet height ~560px, top corners 28px radius
- [ ] Header: `SWITCH LANGUAGE` (10.5px, letter-spacing 0.22em, white/60) and `4 journeys in progress` (22px, font-weight 900)
- [ ] Each row: 12px padding, 18px radius, gap 12px between flag and meta
- [ ] Active row: lime gradient background, 1.5px lime/40 border
- [ ] Ring: 46×46 outer, r=20.5, stroke 2.5px, lime if active else sky
- [ ] Flag inset 5px inside ring (so it's 36×36 visually centered)
- [ ] Stats row: gap 10px, font-weight 900, size 12px
- [ ] Streak: orange (#fb923c) if > 0, white/45 if 0
- [ ] XP: lime (#bef264), formatted as `1.2k` if ≥ 1000
- [ ] CEFR pill: sky/10 background, sky text, 9.5px font, 7px horizontal padding
- [ ] ACTIVE tag: lime bg, dark navy text, 9.5px, letter-spacing 0.14em
- [ ] Footer: 1px white/10 top border, two buttons gap 8px

If any item drifts, the answer is in `mockup-reference.html` — read its CSS,
copy the value into the `.tsx`. The reference is canonical.

---

## 4. Files in this zip

| File | Purpose |
|---|---|
| `README.md` | This document. Read first. |
| `LanguageSwitcher.tsx` | Drop-in replacement for `src/components/LanguageSwitcher.tsx`. |
| `mockup-reference.html` | Standalone, no-deps reference. The visual source of truth. |
| `mockup-reference.png` | Screenshot of the reference at 390×780 for quick visual diffs. |
| `INTEGRATION_NOTES.md` | What PR 2 needs to do for real-data wiring (separate concern). |

---

## 5. What this handoff does NOT cover (out of scope)

- Adding a "My Languages" full-screen page (mockup doesn't have one anymore).
- Per-language CEFR storage (today `preferredLevel` is global; the mock uses it for all rows as a visual approximation — see `INTEGRATION_NOTES.md`).
- Streak-by-language tracking (no Prisma table exists today).
- Any change to `MobileTabBar.tsx` — the trigger pill 🇩🇪 already opens this sheet.

---

## 6. Done criteria

The implementation is done when:

1. The dev environment shows the sheet at 390×780 and it matches `mockup-reference.png` pixel-for-pixel within 1px tolerance.
2. Tapping a non-active row calls `/api/user/preferences` with the new order, then navigates to `/journey`.
3. Tapping "See all" navigates to `/settings#languages`.
4. Tapping "Add language" navigates to `/settings#languages?add=1`.
5. Drag down > 80px or velocity > 600 closes the sheet.
6. Escape key closes the sheet (unless a switch is in flight).
7. With no `targetLanguagesStats` in metadata, the mock fallback renders the 4 sample languages at the values listed in Step 4.
